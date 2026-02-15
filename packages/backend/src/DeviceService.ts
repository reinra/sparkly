import { effects } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { devices, type Device } from './deviceList';
import { sendEffectAsMovie, startEffect } from './effects/EffectLauncher';
import { logger, logError } from './logger';
import { DeviceModeSchema } from './deviceClient/apiContract';
import { DEVICE_MODES } from './deviceClient/DeviceModes';
import { getEffectGroup } from './DeviceHelper';
import { RenderContextImpl } from './render/RenderContext';
import type { FrameBuffer } from './render/FrameOutputStream';
import type { LedMapping } from './DeviceHelper';
import type { DeviceInfo } from '@twinkly-ts/common';
import type { ParameterValue } from './effectParameters';

// ── Result types ──────────────────────────────────────────────────────

export interface SystemInfo {
  buildDate: string;
  version: string;
  deviceModes: typeof DEVICE_MODES;
}

export interface EffectSummary {
  id: string;
  name: string;
}

export interface InfoResult {
  devices: DeviceInfo[];
  effects: EffectSummary[];
}

export interface DebugSection {
  title: string;
  content: string;
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
    const devicesToQuery = deviceId
      ? [this.getDevice(deviceId)]
      : Object.values(devices);

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

      deviceList.push({
        id: device.id,
        alias: device.alias,
        ip: device.api_client.getIp(),
        name: gestalt?.device_name,
        led_count: gestalt?.number_of_led,
        brightness: summary?.filters?.find((f) => f.filter === 'brightness')?.config?.value,
        mode: summary?.led_mode?.mode,
        effect: currentEffect
          ? {
              id: currentEffect.id,
              name: currentEffect.getName(),
              type: currentEffect.effect.constructor.name,
            }
          : null,
        parameters: (await device.helper.getParameters()).list().filter((p) => !p.hidden).map((p) => ({
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
      })),
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

  async sendMovie(deviceId: string, effectId: string): Promise<void> {
    const device = this.getDevice(deviceId);

    const effect = effects[effectId];
    if (!effect) {
      throw new EffectNotFoundError(effectId);
    }

    abortTask(deviceId);

    const renderCtx = new RenderContextImpl(device.helper, effect);
    await sendEffectAsMovie(device, renderCtx, new AbortController().signal).catch((error: unknown) => {
      logError(error).error(`Error sending effect as movie to device ${device.id}`);
    });
  }

  async setParameters(deviceId: string, parameters: { id: string; value: ParameterValue }[]): Promise<void> {
    const device = this.getDevice(deviceId);

    logger.withMetadata({ device_id: deviceId, parameters }).trace(`setParameters called`);
    const params = await device.helper.getParameters();
    for (const param of parameters) {
      params.setValue(param.id, param.value);
    }
  }
}

/** Global singleton instance */
export const deviceService = new DeviceService();
