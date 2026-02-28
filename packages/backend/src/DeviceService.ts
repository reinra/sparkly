import { effects, cloneEffect, deleteEffect, resetEffect } from './effects/EffectLibrary';
import { TaskExecutor } from './TaskExecutor';
import {
  devices,
  probeAndAddDevice,
  AddDeviceError,
  removeDevice,
  RemoveDeviceError,
  discoverDevices,
  reconnectDevice,
} from './DeviceList';
import type { DiscoveredDevice } from '@twinkly-ts/common';
import { sendEffectAsMovie, startEffect } from './render/EffectLauncher';
import type { MovieProgressCallback } from './render/EffectLauncher';
import { logger, logError } from './logger';
import { DeviceModeSchema } from './deviceClient/ApiContract';
import { DEVICE_MODES } from './deviceClient/DeviceModes';
import { getEffectGroup, type DeviceHelper, type LedMapping } from './DeviceHelper';
import { AnimationMode, type EffectLoop, type EffectSequence, type LedPoint } from './effects/Effect';
import { RenderContextImpl } from './render/RenderContext';
import type { FrameBuffer } from './render/FrameOutputStream';
import type { DeviceInfo } from '@twinkly-ts/common';
import type { ParameterValue } from './EffectParameters';
import {
  startMovieTask,
  getMovieTaskProgress,
  updateMovieTask,
  completeMovieTask,
  failMovieTask,
  type MovieTaskProgress,
} from './MovieTaskTracker';

// ── Result types ──────────────────────────────────────────────────────

export interface SystemInfo {
  buildDate: string;
  version: string;
  deviceModes: typeof DEVICE_MODES;
}

export interface EffectSummary {
  id: string;
  name: string;
  canDelete: boolean;
}

export interface InfoResult {
  devices: DeviceInfo[];
  effects: EffectSummary[];
}

export interface DebugSection {
  title: string;
  content: string;
}

export interface DebugEffectEntry {
  id: string;
  name: string;
  pointType: '1D' | '2D';
  animationMode: string;
  isStateful: boolean;
  canDelete: boolean;
  hasCycleReset: boolean;
  duration: number | null;
  parametersCount: number;
}

// ── Errors ────────────────────────────────────────────────────────────

export class DeviceNotFoundError extends Error {
  constructor(deviceId: string) {
    super(`Device with ID ${deviceId} not found`);
    this.name = 'DeviceNotFoundError';
  }
}

export class DeviceOfflineError extends Error {
  constructor(deviceId: string) {
    super(`Device ${deviceId} is currently offline`);
    this.name = 'DeviceOfflineError';
  }
}

export class EffectNotFoundError extends Error {
  constructor(effectId: string) {
    super(`Effect with ID ${effectId} not found`);
    this.name = 'EffectNotFoundError';
  }
}

// ── Service ───────────────────────────────────────────────────────────

/** Business-logic layer. Agnostic of HTTP / TS-Rest. Trusts input types. */
export class DeviceService {
  private taskExecutor = new TaskExecutor();
  private autoRotateTimers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Initialize auto-rotate callbacks for all devices.
   * Should be called once at startup after devices are loaded.
   */
  initAutoRotateCallbacks(): void {
    for (const device of Object.values(devices)) {
      this.initAutoRotateForDevice(device);
    }
  }

  private initAutoRotateForDevice(device: DeviceHelper): void {
    device.setAutoRotateCallback((enabled, intervalSeconds) => {
      if (enabled) {
        this.startAutoRotate(device.id, intervalSeconds);
      } else {
        this.stopAutoRotate(device.id);
      }
    });
  }

  private startAutoRotate(deviceId: string, intervalSeconds: number): void {
    this.stopAutoRotate(deviceId);
    logger.withMetadata({ deviceId, intervalSeconds }).info('Auto-rotate started');

    const timer = setInterval(async () => {
      try {
        const nextEffectId = this.getNextEffectId(deviceId);
        if (nextEffectId) {
          await this.chooseEffect(deviceId, nextEffectId);
          logger.withMetadata({ deviceId, effectId: nextEffectId }).info('Auto-rotate switched effect');
        }
      } catch (error) {
        logError(error).error(`Auto-rotate failed for device ${deviceId}`);
      }
    }, intervalSeconds * 1000);

    this.autoRotateTimers.set(deviceId, timer);
  }

  private stopAutoRotate(deviceId: string): void {
    const timer = this.autoRotateTimers.get(deviceId);
    if (timer) {
      clearInterval(timer);
      this.autoRotateTimers.delete(deviceId);
      logger.withMetadata({ deviceId }).info('Auto-rotate stopped');
    }
  }

  private getNextEffectId(deviceId: string): string | null {
    const rotatableIds = Object.keys(effects).filter((id) => !effects[id].effect.skipInAutoRotate);
    if (rotatableIds.length === 0) return null;

    const device = this.getDevice(deviceId);
    const currentEffect = device.getCurrentEffect();
    if (!currentEffect) {
      return rotatableIds[0];
    }

    const currentIndex = rotatableIds.indexOf(currentEffect.id);
    // If current effect is not in the rotatable list (e.g. a test effect), start from the beginning
    if (currentIndex === -1) return rotatableIds[0];
    return rotatableIds[(currentIndex + 1) % rotatableIds.length];
  }

  getDevice(deviceId: string): DeviceHelper {
    const device = devices[deviceId];
    if (!device) {
      throw new DeviceNotFoundError(deviceId);
    }
    return device;
  }

  /** Get device and verify it's online. Throws DeviceOfflineError if not. */
  getOnlineDevice(deviceId: string): DeviceHelper {
    const device = this.getDevice(deviceId);
    if (!device.isOnline()) {
      throw new DeviceOfflineError(deviceId);
    }
    return device;
  }

  getSystemInfo(): SystemInfo {
    return {
      // @ts-ignore – Injected by Bun at build time
      buildDate: typeof BUILD_DATE !== 'undefined' ? BUILD_DATE : process.env.BUILD_DATE || new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      deviceModes: DEVICE_MODES,
    };
  }

  async getInfo(deviceId?: string): Promise<InfoResult> {
    const devicesToQuery = deviceId ? (devices[deviceId] ? [devices[deviceId]] : []) : Object.values(devices);

    const deviceList: DeviceInfo[] = [];

    for (const device of devicesToQuery) {
      // For offline devices, return minimal info
      if (!device.isOnline()) {
        deviceList.push({
          id: device.id,
          alias: device.alias,
          ip: device.apiClient.getIp(),
          connectionStatus: device.connectionStatus,
          effect: null,
          parameters: [],
        });
        continue;
      }

      // Periodically refresh state from device to stay in sync with external changes
      try {
        await device.refreshStateFromDeviceIfStale();
      } catch (error) {
        logError(error).error(`Error refreshing state for device ${device.id}`);
      }

      const currentEffect = device.getCurrentEffect();
      const ledCount = await device.getLedCount();

      // Compute loop duration for loop effects when LED count is known
      let loopDurationSeconds: number | undefined;
      if (currentEffect && ledCount && currentEffect.effect.animationMode === AnimationMode.Loop) {
        loopDurationSeconds = (currentEffect.effect as EffectLoop<LedPoint>).getLoopDurationSeconds(ledCount);
      }

      deviceList.push({
        id: device.id,
        alias: device.alias,
        ip: device.apiClient.getIp(),
        connectionStatus: device.connectionStatus,
        name: await device.getDeviceName(),
        led_count: ledCount,
        brightness: device.getBrightness(),
        mode: device.getMode(),
        effect: currentEffect
          ? {
              id: currentEffect.id,
              name: currentEffect.getName(),
              type: currentEffect.effect.constructor.name,
              pointType: currentEffect.effect.pointType,
              animationMode: currentEffect.effect.animationMode as string,
              ...(loopDurationSeconds !== undefined && { loop_duration_seconds: loopDurationSeconds }),
            }
          : null,
        parameters: (await device.getParameters())
          .list()
          .filter((p) => !p.hidden)
          .map((p) => ({
            ...p,
            group: getEffectGroup(p),
          })),
      });
    }

    logger
      .withMetadata({ devices: deviceList })
      .trace(`getInfo called, returning info for ${deviceList.length} device(s)`);

    return {
      devices: deviceList,
      effects: Object.entries(effects).map(([id, effect]) => ({
        id,
        name: effect.getName(),
        canDelete: effect.canDelete,
      })),
    };
  }

  getDebugEffects(): { effects: DebugEffectEntry[] } {
    return {
      effects: Object.entries(effects).map(([id, wrapper]) => {
        const effect = wrapper.effect;
        let duration: number | null = null;
        if (effect.animationMode === AnimationMode.Loop) {
          duration = (effect as EffectLoop<LedPoint>).getLoopDurationSeconds(100);
        }
        const hasCycleReset =
          effect.animationMode === AnimationMode.Sequence && (effect as EffectSequence<any>).hasCycleReset === true;
        const parametersCount = wrapper
          .getEffectParameters()
          .list()
          .filter((p) => !p.hidden).length;
        return {
          id,
          name: wrapper.getName(),
          pointType: effect.pointType,
          animationMode: effect.animationMode as string,
          isStateful: effect.isStateful,
          canDelete: wrapper.canDelete,
          hasCycleReset,
          duration,
          parametersCount,
        };
      }),
    };
  }

  async debugDevice(deviceId: string): Promise<DebugSection[]> {
    const device = this.getOnlineDevice(deviceId);
    const debugInfo = await device.getDebugInfo();
    return debugInfo.map((section) => ({
      title: section.title,
      content: JSON.stringify(section.content, null, 2),
    }));
  }

  async setMode(deviceId: string, mode: string): Promise<void> {
    const device = this.getOnlineDevice(deviceId);
    const validMode = DeviceModeSchema.parse(mode);

    if (validMode !== DeviceModeSchema.Values.rt) {
      this.taskExecutor.abortTask(deviceId);
    }

    await device.setMode(validMode);
  }

  async setBrightness(deviceId: string, brightness: number): Promise<void> {
    const device = this.getOnlineDevice(deviceId);
    const params = await device.getParameters();
    params.setValue('device.brightness', brightness);
  }

  async chooseEffect(deviceId: string, effectId: string | null): Promise<void> {
    const device = this.getOnlineDevice(deviceId);

    if (effectId) {
      const effect = effects[effectId];
      if (!effect) {
        throw new EffectNotFoundError(effectId);
      }

      device.setCurrentEffect(effect);
      const renderCtx = new RenderContextImpl(device, effect);
      this.taskExecutor.startAndAbortPreviousTask(deviceId, {
        run: async (signal) => {
          await startEffect(device, renderCtx, signal);
        },
      });
    } else {
      device.setCurrentEffect(null);
      this.taskExecutor.abortTask(deviceId);
    }
  }

  getBuffer(deviceId: string): FrameBuffer {
    const device = this.getOnlineDevice(deviceId);
    return device.buffer;
  }

  async getLedMapping(deviceId: string): Promise<LedMapping> {
    const device = this.getOnlineDevice(deviceId);
    return device.getLedMapping();
  }

  /**
   * Start sending an effect as a movie to the device.
   * Returns immediately — the actual rendering + upload runs in the background.
   * Progress can be polled via getMovieStatus().
   */
  async sendMovie(deviceId: string, effectId: string): Promise<void> {
    const device = this.getOnlineDevice(deviceId);

    const effect = effects[effectId];
    if (!effect) {
      throw new EffectNotFoundError(effectId);
    }

    this.taskExecutor.abortTask(deviceId);

    const taskProgress = startMovieTask(deviceId, effect.getName());

    const renderCtx = new RenderContextImpl(device, effect);
    const progressCb: MovieProgressCallback = {
      onRenderStart(totalFrames, effectDurationMs) {
        updateMovieTask(deviceId, { totalFrames, effectDurationMs });
      },
      onFrameRendered(frameIndex, totalFrames) {
        const progress = totalFrames ? frameIndex / totalFrames : 0;
        updateMovieTask(deviceId, { framesRendered: frameIndex, progress });
      },
      onUploadStart(frameCount, uploadBytesTotal, effectDurationMs) {
        updateMovieTask(deviceId, {
          status: 'uploading',
          frameCount,
          framesRendered: frameCount,
          uploadBytesTotal,
          uploadBytesSent: 0,
          effectDurationMs,
        });
      },
      onUploadProgress(bytesSent, _bytesTotal) {
        updateMovieTask(deviceId, { uploadBytesSent: bytesSent });
      },
      onConfiguring() {
        updateMovieTask(deviceId, { status: 'configuring' });
      },
      onComplete(frameCount, effectDurationMs) {
        completeMovieTask(deviceId, frameCount, effectDurationMs);
      },
      onError(error) {
        failMovieTask(deviceId, error);
      },
    };

    // Fire-and-forget — run in the background
    this.taskExecutor.startAndAbortPreviousTask(deviceId, {
      run: async (signal) => {
        try {
          await sendEffectAsMovie(device, renderCtx, signal, progressCb);
        } catch (error: unknown) {
          // Abort errors happen when user starts a new task — don't mark as failed
          // since a new task will overwrite the tracker entry
          const isAbort =
            error instanceof Error &&
            (error.name === 'AbortError' || error.message?.includes('The operation was aborted'));
          if (!isAbort) {
            failMovieTask(deviceId, error instanceof Error ? error.message : 'Unknown error');
          }
          throw error; // Re-throw for backendLoops logging
        }
      },
    });
  }

  /** Get current movie-send progress for a device, or null if none. */
  getMovieStatus(deviceId: string): MovieTaskProgress | null {
    if (!devices[deviceId]) return null;
    return getMovieTaskProgress(deviceId);
  }

  async setParameters(deviceId: string, parameters: { id: string; value: ParameterValue }[]): Promise<void> {
    const device = this.getOnlineDevice(deviceId);

    logger.withMetadata({ device_id: deviceId, parameters }).trace(`setParameters called`);
    const params = await device.getParameters();
    for (const param of parameters) {
      params.setValue(param.id, param.value);
    }
  }

  cloneEffect(effectId: string): { id: string; name: string } {
    const result = cloneEffect(effectId);
    logger.withMetadata({ sourceId: effectId, newId: result.id, newName: result.name }).info('Effect cloned');
    return result;
  }

  deleteEffect(effectId: string): void {
    // If any device is currently running this effect, stop it
    for (const device of Object.values(devices)) {
      const currentEffect = device.getCurrentEffect();
      if (currentEffect && currentEffect.id === effectId) {
        device.setCurrentEffect(null);
        this.taskExecutor.abortTask(device.id);
      }
    }
    deleteEffect(effectId);
    logger.withMetadata({ effectId }).info('Effect deleted');
  }

  /**
   * Reset an effect to its code-defined defaults by replacing it with a fresh instance.
   * Any device running this effect is re-attached to the new instance and restarted.
   */
  async resetEffect(effectId: string): Promise<void> {
    const newWrapper = resetEffect(effectId);
    logger.withMetadata({ effectId }).info('Effect reset to defaults');

    // Re-attach any devices that were running this effect
    for (const device of Object.values(devices)) {
      const currentEffect = device.getCurrentEffect();
      if (currentEffect && currentEffect.id === effectId) {
        device.setCurrentEffect(newWrapper);
        if (device.isOnline()) {
          const renderCtx = new RenderContextImpl(device, newWrapper);
          this.taskExecutor.startAndAbortPreviousTask(device.id, {
            run: async (signal) => {
              await startEffect(device, renderCtx, signal);
            },
          });
        }
      }
    }
  }

  /**
   * Remove a device by ID.
   * Stops running tasks, clears state, removes from in-memory list and config.toml.
   */
  removeDevice(deviceId: string): { success: true } | { success: false; error: string } {
    try {
      this.taskExecutor.abortTask(deviceId);
      this.stopAutoRotate(deviceId);

      const device = devices[deviceId];
      if (device) {
        device.setCurrentEffect(null);
      }

      removeDevice(deviceId);
      return { success: true };
    } catch (error) {
      if (error instanceof RemoveDeviceError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Attempt to reconnect an offline device.
   */
  async reconnectDevice(deviceId: string): Promise<{ success: true } | { success: false; error: string }> {
    const device = devices[deviceId];
    if (!device) {
      return { success: false, error: `Device with ID ${deviceId} not found.` };
    }
    if (device.isOnline()) {
      return { success: true };
    }
    const reconnected = await reconnectDevice(deviceId);
    if (reconnected) {
      this.initAutoRotateForDevice(device);
      return { success: true };
    }
    return { success: false, error: `Device ${deviceId} is still unreachable at ${device.apiClient.getIp()}.` };
  }

  /**
   * Discover Twinkly devices on the local network via UDP broadcast.
   * Returns enriched results with device names and already-added status.
   */
  async discoverDevices(): Promise<{ devices: DiscoveredDevice[] }> {
    const found = await discoverDevices();
    return { devices: found };
  }

  /**
   * Add a new device by IP address.
   * Probes the device, adds to in-memory list, persists to config.toml.
   * Returns success result or error result with descriptive message.
   */
  async addDevice(
    ip: string
  ): Promise<{ success: true; deviceId: string; deviceName: string } | { success: false; error: string }> {
    try {
      const result = await probeAndAddDevice(ip);
      // Initialize auto-rotate callback for the new device
      const device = devices[result.deviceId];
      if (device) {
        this.initAutoRotateForDevice(device);
      }
      return result;
    } catch (error) {
      if (error instanceof AddDeviceError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/** Global singleton instance */
export const deviceService = new DeviceService();

// Initialize auto-rotate callbacks for all configured devices
deviceService.initAutoRotateCallbacks();
