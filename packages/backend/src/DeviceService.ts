import { effects, cloneEffect, deleteEffect } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { devices, type Device } from './deviceList';
import { sendEffectAsMovie, startEffect } from './render/EffectLauncher';
import type { MovieProgressCallback } from './render/EffectLauncher';
import { logger, logError } from './logger';
import { DeviceModeSchema } from './deviceClient/apiContract';
import { DEVICE_MODES } from './deviceClient/DeviceModes';
import { getEffectGroup } from './DeviceHelper';
import { AnimationMode, type EffectLoop, type LedPoint } from './effects/Effect';
import { RenderContextImpl } from './render/RenderContext';
import type { FrameBuffer } from './render/FrameOutputStream';
import type { LedMapping } from './DeviceHelper';
import type { DeviceInfo } from '@twinkly-ts/common';
import type { ParameterValue } from './effectParameters';
import {
  startMovieTask,
  getMovieTaskProgress,
  updateMovieTask,
  completeMovieTask,
  failMovieTask,
  type MovieTaskProgress,
} from './movieTaskTracker';

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

export class EffectNotFoundError extends Error {
  constructor(effectId: string) {
    super(`Effect with ID ${effectId} not found`);
    this.name = 'EffectNotFoundError';
  }
}

// ── Service ───────────────────────────────────────────────────────────

/** Business-logic layer. Agnostic of HTTP / TS-Rest. Trusts input types. */
export class DeviceService {
  getDevice(deviceId: string): Device {
    const device = devices[deviceId];
    if (!device) {
      throw new DeviceNotFoundError(deviceId);
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
    const devicesToQuery = deviceId ? [this.getDevice(deviceId)] : Object.values(devices);

    const deviceList: DeviceInfo[] = [];

    for (const device of devicesToQuery) {
      let gestalt = null;
      try {
        gestalt = await device.api_client.gestalt();
      } catch (error) {
        logError(error).error(`Error fetching gestalt for device ${device.id}`);
      }

      let summary = null;
      try {
        summary = await device.api_client.getSummary();
      } catch (error) {
        logError(error).error(`Error fetching summary for device ${device.id}`);
      }

      const currentEffect = device.helper.getCurrentEffect();
      const ledCount = gestalt?.number_of_led;

      // Compute loop duration for loop effects when LED count is known
      let loopDurationSeconds: number | undefined;
      if (currentEffect && ledCount && currentEffect.effect.animationMode === AnimationMode.Loop) {
        loopDurationSeconds = (currentEffect.effect as EffectLoop<LedPoint>).getLoopDurationSeconds(ledCount);
      }

      deviceList.push({
        id: device.id,
        alias: device.alias,
        ip: device.api_client.getIp(),
        name: gestalt?.device_name,
        led_count: ledCount,
        brightness: summary?.filters?.find((f) => f.filter === 'brightness')?.config?.value,
        mode: summary?.led_mode?.mode,
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
        parameters: (await device.helper.getParameters())
          .list()
          .filter((p) => !p.hidden)
          .map((p) => ({
            ...p,
            group: getEffectGroup(p),
          })),
      });

      logger
        .withMetadata({ deviceId: device.id, paramCount: deviceList[deviceList.length - 1].parameters.length })
        .info('Device parameters loaded');
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
          duration,
          parametersCount,
        };
      }),
    };
  }

  async debugDevice(deviceId: string): Promise<DebugSection[]> {
    const device = this.getDevice(deviceId);
    const debugInfo = await device.helper.getDebugInfo();
    return debugInfo.map((section) => ({
      title: section.title,
      content: JSON.stringify(section.content, null, 2),
    }));
  }

  async setMode(deviceId: string, mode: string): Promise<void> {
    const device = this.getDevice(deviceId);
    const validMode = DeviceModeSchema.parse(mode);

    if (validMode !== DeviceModeSchema.Values.rt) {
      abortTask(deviceId);
    }

    await device.api_client.setMode(validMode);
  }

  async setBrightness(deviceId: string, brightness: number): Promise<void> {
    const device = this.getDevice(deviceId);
    await device.api_client.setBrightnessAbsolute(brightness);
  }

  async chooseEffect(deviceId: string, effectId: string | null): Promise<void> {
    const device = this.getDevice(deviceId);

    if (effectId) {
      const effect = effects[effectId];
      if (!effect) {
        throw new EffectNotFoundError(effectId);
      }

      device.helper.setCurrentEffect(effect);
      const renderCtx = new RenderContextImpl(device.helper, effect);
      startAndAbortPreviousTask(deviceId, {
        run: async (signal) => {
          await startEffect(device, renderCtx, signal);
        },
      });
    } else {
      device.helper.setCurrentEffect(null);
      abortTask(deviceId);
    }
  }

  getBuffer(deviceId: string): FrameBuffer {
    const device = this.getDevice(deviceId);
    return device.buffer;
  }

  async getLedMapping(deviceId: string): Promise<LedMapping> {
    const device = this.getDevice(deviceId);
    return device.helper.getLedMapping();
  }

  /**
   * Start sending an effect as a movie to the device.
   * Returns immediately — the actual rendering + upload runs in the background.
   * Progress can be polled via getMovieStatus().
   */
  async sendMovie(deviceId: string, effectId: string): Promise<void> {
    const device = this.getDevice(deviceId);

    const effect = effects[effectId];
    if (!effect) {
      throw new EffectNotFoundError(effectId);
    }

    abortTask(deviceId);

    const taskProgress = startMovieTask(deviceId, effect.getName());

    const renderCtx = new RenderContextImpl(device.helper, effect);
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
    startAndAbortPreviousTask(deviceId, {
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
    // Validate device exists
    this.getDevice(deviceId);
    return getMovieTaskProgress(deviceId);
  }

  async setParameters(deviceId: string, parameters: { id: string; value: ParameterValue }[]): Promise<void> {
    const device = this.getDevice(deviceId);

    logger.withMetadata({ device_id: deviceId, parameters }).trace(`setParameters called`);
    const params = await device.helper.getParameters();
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
      const currentEffect = device.helper.getCurrentEffect();
      if (currentEffect && currentEffect.id === effectId) {
        device.helper.setCurrentEffect(null);
        abortTask(device.id);
      }
    }
    deleteEffect(effectId);
    logger.withMetadata({ effectId }).info('Effect deleted');
  }
}

/** Global singleton instance */
export const deviceService = new DeviceService();
