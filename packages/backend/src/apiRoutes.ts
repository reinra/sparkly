import { effects } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { devices, type Device } from './deviceList';
import { sendEffectAsMovie, startEffect } from './effects/EffectLauncher';
import { logger, logError } from './logger';
import { DeviceModeSchema } from './deviceClient/apiContract';
import { DEVICE_MODES } from './deviceClient/DeviceModes';
import { DeviceInfo } from '@twinkly-ts/common';
import { getEffectGroup } from './DeviceHelper';

// Helper function to get device or throw error
export function getDeviceOrError(device_id: string): Device {
  const device = devices[device_id];
  if (!device) {
    throw new Error(`Device with ID ${device_id} not found`);
  }
  return device;
}

// All API route handlers - shared between development and production servers
export const apiRoutes = {
  hello: (req: any, res: any) => {
    res.json({
      message: 'Hello from Twinkly Backend!',
    });
  },

  getSystemInfo: (req: any, res: any) => {
    res.json({
      // @ts-ignore - Injected by Bun at build time
      buildDate: typeof BUILD_DATE !== 'undefined' ? BUILD_DATE : process.env.BUILD_DATE || new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      deviceModes: DEVICE_MODES
    });
  },

  getInfo: async (req: any, res: any) => {
    const { device_id } = req.query;
    const deviceList: DeviceInfo[] = [];

    // Filter devices if device_id is provided
    const devicesToQuery = device_id ? [getDeviceOrError(device_id as string)] : Object.values(devices);

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

      deviceList.push({
        id: device.id,
        alias: device.alias,
        ip: device.api_client.getIp(),
        name: gestalt?.device_name,
        led_count: gestalt?.number_of_led,
        brightness: summary?.filters?.find((filter) => filter.filter == 'brightness')?.config?.value,
        mode: summary?.led_mode?.mode,
        effect_id: device.effect_id,
        parameters: (await device.helper.getParameters()).list().filter((param) => !param.hidden).map((param) => ({
          ...param,
          group: getEffectGroup(param),
        }))
      });

      logger
        .withMetadata({ deviceId: device.id, paramCount: deviceList[deviceList.length - 1].parameters.length })
        .info('Device parameters loaded');
    }

    logger
      .withMetadata({ devices: deviceList })
      .trace(`getInfo called, returning info for ${deviceList.length} device(s)`);

    res.json({
      devices: deviceList,
      effects: Object.entries(effects).map(([id, effect]) => ({
        id,
        name: effect.getName(),
      })),
    });
  },

  debugDevice: async (req: any, res: any) => {
    const { device_id } = req.query;
    const device = getDeviceOrError(device_id as string);
    const debugInfo = await device.helper.getDebugInfo();

    res.json({
      sections: debugInfo.map((section) => ({
        title: section.title,
        content: JSON.stringify(section.content, null, 2),
      })),
    });
  },

  setMode: async (req: any, res: any) => {
    const { device_id, mode } = req.body;
    const device = getDeviceOrError(device_id);
    const validMode = DeviceModeSchema.parse(mode);

    if (validMode !== DeviceModeSchema.Values.rt) {
      const taskKey = device_id;
      abortTask(taskKey);
    }

    await device.api_client.setMode(validMode);

    res.json({
      success: true,
      mode,
    });
  },

  setBrightness: async (req: any, res: any) => {
    const { device_id, brightness } = req.body;
    const device = getDeviceOrError(device_id);
    await device.api_client.setBrightnessAbsolute(brightness);

    res.json({
      success: true,
    });
  },

  chooseEffect: async (req: any, res: any) => {
    const { device_id, effect_id } = req.body;
    const device = getDeviceOrError(device_id);
    const taskKey = device_id;

    if (effect_id) {
      const effect = effects[effect_id];
      if (!effect) {
        res.status(404).json({
          error: `Effect with ID ${effect_id} not found`,
        });
        return;
      }

      device.effect_id = effect_id;
      device.helper.setCurrentEffect(effect);
      startAndAbortPreviousTask(taskKey, {
        run: async (signal) => {
          await startEffect(device, effect, signal);
        },
      });
    } else {
      device.effect_id = null;
      device.helper.setCurrentEffect(null);
      abortTask(taskKey);
    }

    res.json({
      success: true,
    });
  },

  getBuffer: async (req: any, res: any) => {
    const { device_id } = req.query;
    const device = getDeviceOrError(device_id as string);
    res.json(device.buffer);
  },

  getLedMapping: async (req: any, res: any) => {
    const { device_id } = req.query;
    const device = getDeviceOrError(device_id as string);
    const ledMapping = await device.helper.getLedMapping();
    res.json(ledMapping);
  },

  sendMovie: async (req: any, res: any) => {
    const { device_id, effect_id } = req.body;
    const device = getDeviceOrError(device_id);
    const taskKey = device_id;

    const effect = effects[effect_id];
    if (!effect) {
      res.status(404).json({
        error: `Effect with ID ${effect_id} not found`,
      });
      return;
    }

    abortTask(taskKey);

    await sendEffectAsMovie(device, effect, new AbortController().signal).catch((error: unknown) => {
      logError(error).error(`Error sending effect as movie to device ${device.id}`);
    });

    res.json({
      success: true,
    });
  },

  setParameters: async (req: any, res: any) => {
    const { device_id, parameters } = req.body;
    const device = getDeviceOrError(device_id);

    logger.withMetadata({ device_id, parameters }).trace(`setParameters called`);
    const params = await device.helper.getParameters();
    for (const param of parameters) {
      params.setValue(param.id, param.value);
    }

    res.json({
      success: true,
    });
  },
};
