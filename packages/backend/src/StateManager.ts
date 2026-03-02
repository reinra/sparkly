import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { getConfigPath } from './config';
import { effects, effectClassRegistry, getDefaultEffectOrder } from './effects/EffectLibrary';
import type { AnyEffect } from './effects/Effect';
import { EffectWrapper } from './EffectWrapper';
import type { EffectParameterView } from './EffectParameters';
import { devices } from './DeviceList';
import { deviceService } from './DeviceService';
import { logger } from './logger';

const STATE_VERSION = 1;
const AUTO_SAVE_INTERVAL_MS = 60_000; // 1 minute
const DIRTY_FLUSH_DEBOUNCE_MS = 2_000; // 2 seconds

// ── Types ─────────────────────────────────────────────────────────────

interface PersistedEffect {
  name?: string;
  effectClassId?: string;
  parameters: Record<string, unknown>;
}

interface PersistedDevice {
  parameters: Record<string, unknown>;
  activeEffectId: string | null;
}

interface PersistedState {
  version: number;
  savedAt: string;
  effectOrder?: string[];
  effects: Record<string, PersistedEffect>;
  devices: Record<string, PersistedDevice>;
}

// ── Paths ─────────────────────────────────────────────────────────────

function getStatePaths() {
  const dir = dirname(getConfigPath());
  return {
    state: join(dir, 'state.json'),
    backup: join(dir, 'state.backup.json'),
    tmp: join(dir, 'state.tmp.json'),
  };
}

// ── Dirty flag & auto-save ────────────────────────────────────────────

let dirty = false;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let dirtyFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDirtyFlush(): void {
  if (dirtyFlushTimer) clearTimeout(dirtyFlushTimer);
  dirtyFlushTimer = setTimeout(() => {
    dirtyFlushTimer = null;
    if (dirty) saveState();
  }, DIRTY_FLUSH_DEBOUNCE_MS);
}

export function markDirty(): void {
  dirty = true;
  scheduleDirtyFlush();
}

export function startAutoSave(): void {
  if (autoSaveTimer) return;
  autoSaveTimer = setInterval(() => {
    if (dirty) saveState();
  }, AUTO_SAVE_INTERVAL_MS);
  logger.info('State auto-save enabled (every 1 minute if changed)');
}

// ── Shutdown hooks ────────────────────────────────────────────────────

export function setupShutdownHooks(): void {
  const onShutdown = (signal: string) => {
    logger.info(`Received ${signal}, saving state before exit...`);
    if (dirty) saveState();
    process.exit(0);
  };

  process.on('SIGINT', () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => onShutdown('SIGBREAK'));
  }
}

// ── Save ──────────────────────────────────────────────────────────────

function snapshotParams(view: EffectParameterView): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const p of view.list()) {
    if (p.transient) continue;
    if (p.isDefault()) continue;
    result[p.id] = p.value;
  }
  return result;
}

function buildState(): PersistedState {
  const effectOrder: string[] = [];
  const persistedEffects: Record<string, PersistedEffect> = {};

  for (const [id, wrapper] of Object.entries(effects)) {
    effectOrder.push(id);

    // Persist names for user-created/cloned effects even if they are "default" for that wrapper.
    // Their default names are runtime-generated and cannot be reconstructed deterministically.
    const name = wrapper.canDelete || !wrapper.isDefaultName() ? wrapper.getName() : undefined;
    const effectClassId = wrapper.canDelete ? wrapper.effect.effectClassId : undefined;
    const parameters = snapshotParams(wrapper.getEffectParameters());

    // Skip system effects that have no customizations at all
    if (!name && !effectClassId && Object.keys(parameters).length === 0) continue;

    persistedEffects[id] = { name, effectClassId, parameters };
  }

  const persistedDevices: Record<string, PersistedDevice> = {};
  for (const device of Object.values(devices)) {
    const ip = device.apiClient.getIp();
    persistedDevices[ip] = {
      parameters: snapshotParams(device.getDeviceParams()),
      activeEffectId: device.getCurrentEffect()?.id ?? null,
    };
  }

  // Only persist effectOrder if it differs from the default registration order
  const defaultOrder = getDefaultEffectOrder();
  const orderChanged =
    effectOrder.length !== defaultOrder.length || effectOrder.some((id, i) => id !== defaultOrder[i]);

  return {
    version: STATE_VERSION,
    savedAt: new Date().toISOString(),
    effectOrder: orderChanged ? effectOrder : undefined,
    effects: persistedEffects,
    devices: persistedDevices,
  };
}

export function saveState(): void {
  try {
    const paths = getStatePaths();
    const json = JSON.stringify(buildState(), null, 2);

    // Write to temp file first
    writeFileSync(paths.tmp, json, 'utf-8');

    // Rotate: current → backup
    if (existsSync(paths.state)) {
      try {
        renameSync(paths.state, paths.backup);
      } catch {
        // If backup rotation fails, continue anyway
      }
    }

    // Promote: tmp → current
    renameSync(paths.tmp, paths.state);
    dirty = false;
    if (dirtyFlushTimer) {
      clearTimeout(dirtyFlushTimer);
      dirtyFlushTimer = null;
    }
    logger.info('State saved to disk');
  } catch (error) {
    logger.withError(error as Error).error('Failed to save state');
  }
}

// ── Load ──────────────────────────────────────────────────────────────

function tryLoadFile(filePath: string): PersistedState | null {
  if (!existsSync(filePath)) return null;
  try {
    const json = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(json) as PersistedState;
    if (!data.effects) {
      logger.warn(`State file is missing required fields: ${filePath}`);
      return null;
    }
    if (data.version !== STATE_VERSION) {
      logger.warn(`State file version ${data.version}, expected ${STATE_VERSION} — attempting best-effort restore`);
    }
    return data;
  } catch (error) {
    logger.withError(error as Error).warn(`Failed to parse state file: ${filePath}`);
    return null;
  }
}

// ── Restore ───────────────────────────────────────────────────────────

export function restoreState(): void {
  const paths = getStatePaths();
  const state = tryLoadFile(paths.state) ?? tryLoadFile(paths.backup);
  if (!state) {
    logger.info('No persisted state found, starting fresh');
    return;
  }

  logger.info(`Restoring state saved at ${state.savedAt}`);
  restoreEffects(state);
  restoreDevices(state);
}

function restoreEffects(state: PersistedState): void {
  let restoredCount = 0;
  let cloneCount = 0;
  let skippedCount = 0;

  // Phase 1: Restore parameters for existing library effects
  for (const [effectId, saved] of Object.entries(state.effects)) {
    const wrapper = effects[effectId];
    if (!wrapper) continue;
    restoreParams(wrapper.getEffectParameters(), saved.parameters);
    if (saved.name) {
      try {
        wrapper.setName(saved.name);
      } catch {
        /* skip invalid names */
      }
    }
    restoredCount++;
  }

  // Phase 2: Rebuild effects record in saved order, inserting clones
  // If effectOrder is absent, the default code order is already correct
  if (!state.effectOrder) {
    logger.info(`Effects restored: ${restoredCount} updated (default order preserved)`);
    return;
  }

  const rebuilt: [string, EffectWrapper][] = [];

  for (const effectId of state.effectOrder) {
    if (effects[effectId]) {
      rebuilt.push([effectId, effects[effectId]]);
      continue;
    }

    // Clone: reconstruct from effectClassId
    const saved = state.effects[effectId];
    if (!saved?.effectClassId) continue;

    const EffectClass = effectClassRegistry.get(saved.effectClassId);
    if (!EffectClass) {
      logger.warn(`Cannot restore effect '${effectId}': effectClassId '${saved.effectClassId}' not found`);
      skippedCount++;
      continue;
    }

    const effect = new EffectClass();
    const wrapper = new EffectWrapper(effectId, effect, saved.name || getFallbackCloneName(effect), true);
    restoreParams(wrapper.getEffectParameters(), saved.parameters);
    rebuilt.push([effectId, wrapper]);
    cloneCount++;
  }

  // Append any new effects not in saved order (added in newer version)
  const rebuiltIds = new Set(rebuilt.map(([id]) => id));
  for (const [id, wrapper] of Object.entries(effects)) {
    if (!rebuiltIds.has(id)) {
      rebuilt.push([id, wrapper]);
    }
  }

  // Replace the effects record in-place
  for (const key of Object.keys(effects)) delete effects[key];
  for (const [id, wrapper] of rebuilt) effects[id] = wrapper;

  logger.info(`Effects restored: ${restoredCount} updated, ${cloneCount} clones recreated, ${skippedCount} skipped`);
}

function getFallbackCloneName(effect: AnyEffect): string {
  return effect.effectName ? `Copy of ${effect.effectName}` : 'Restored Effect';
}

function restoreParams(paramView: EffectParameterView, parameters: Record<string, unknown>): void {
  for (const [paramId, value] of Object.entries(parameters)) {
    try {
      paramView.setValue(paramId, value as any);
    } catch {
      // Param may no longer exist or value may be invalid — skip silently
    }
  }
}

function restoreDevices(state: PersistedState): void {
  if (!state.devices) return;

  let matchCount = 0;
  for (const device of Object.values(devices)) {
    const saved = state.devices[device.apiClient.getIp()];
    if (!saved) continue;
    matchCount++;

    if (saved.parameters) {
      restoreParams(device.getDeviceParams(), saved.parameters);
    }
    if (saved.activeEffectId && effects[saved.activeEffectId]) {
      device.setCurrentEffect(effects[saved.activeEffectId]);
    }
  }

  logger.info(`Device state restored for ${matchCount}/${Object.keys(devices).length} device(s)`);
}

// ── Public initialization ─────────────────────────────────────────────────────

/**
 * One-call initialization: restore persisted state, set up auto-rotate,
 * shutdown hooks, and periodic auto-save.
 * Call once at server startup after effects and devices are registered.
 */
export function initializeState(): void {
  restoreState();
  deviceService.initAutoRotateCallbacks();
  setupShutdownHooks();
  startAutoSave();
}
