import express from 'express';
import cors from 'cors';
import { logger, logError } from './logger';
import { backendApiContract, Mode } from '@twinkly-ts/common';
import { effects } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { registerRoutes } from './typedHandler';
import { devices, tryToConnectAll, type Device } from './deviceList';
import { sendEffectAsMovie, startEffect } from './effects/EffectLauncher';

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Helper function to get device or throw error
function getDeviceOrError(device_id: string): Device {
  const device = devices[device_id];
  if (!device) {
    throw new Error(`Device with ID ${device_id} not found`);
  }
  return device;
}

// Register all API routes
registerRoutes(app, backendApiContract, {
  hello: (req, res) => {
    res.json({
      message: 'Hello from Twinkly Backend!',
    });
  },

  getInfo: async (req, res) => {
    const { device_id } = req.query;
    const deviceList = [];

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
        parameters: (await device.helper.getParameters()).list(),
      });

      logger
        .withMetadata({ deviceId: device.id, paramCount: deviceList[deviceList.length - 1].parameters.length })
        .info('Device parameters loaded');
    }

    logger
      .withMetadata({ devices: deviceList })
      .info(`getInfo called, returning info for ${deviceList.length} device(s)`);

    res.json({
      devices: deviceList,
      effects: Object.entries(effects).map(([id, effect]) => ({
        id,
        name: effect.getName(),
      })),
    });
  },

  status: async (req, res) => {
    // Use the first device for now
    const apiClient = Object.values(devices)[0].api_client;
    const gestalt = await apiClient.gestalt();
    const summary = await apiClient.getSummary();
    const ledConfig = await apiClient.getLedConfig();
    const movieConfig = await apiClient.getLedMovieConfig();

    res.json({
      device: JSON.stringify(gestalt, null, 2) as any,
      summary: JSON.stringify(summary, null, 2) as any,
      ledConfig: JSON.stringify(ledConfig, null, 2) as any,
      movieConfig: JSON.stringify(movieConfig, null, 2),
    });
  },

  setMode: async (req, res) => {
    const { device_id, mode } = req.body;
    const device = getDeviceOrError(device_id);

    if (mode !== Mode.rt) {
      const taskKey = device_id;
      abortTask(taskKey);
    }

    await device.api_client.setMode(mode);

    res.json({
      success: true,
      mode,
    });
  },

  setBrightness: async (req, res) => {
    const { device_id, brightness } = req.body;
    const device = getDeviceOrError(device_id);
    await device.api_client.setBrightnessAbsolute(brightness);

    res.json({
      success: true,
    });
  },

  chooseEffect: async (req, res) => {
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
      startAndAbortPreviousTask(taskKey, {
        run: async (signal) => {
          await startEffect(device, effect, signal);
        },
      });
    } else {
      device.effect_id = null;
      abortTask(taskKey);
    }

    res.json({
      success: true,
    });
  },
  getBuffer: async (req, res) => {
    const { device_id } = req.query;
    const device = getDeviceOrError(device_id as string);
    res.json(device.buffer);
  },
  getLedMapping: async (req, res) => {
    const { device_id } = req.query;
    const device = getDeviceOrError(device_id as string);
    const ledMapping = await device.helper.getLedMapping();
    res.json(ledMapping);
  },
  sendMovie: async (req, res) => {
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

  setParameters: async (req, res) => {
    const { device_id, parameters } = req.body;
    const device = getDeviceOrError(device_id);

    logger.withMetadata({ device_id, parameters }).info(`setParameters called`);
    const params = await device.helper.getParameters();
    for (const param of parameters) {
      params.setValue(param.id, param.value);
    }

    res.json({
      success: true,
    });
  },
});

app.listen(PORT, () => {
  logger.info(`Backend server running on http://localhost:${PORT}`);

  tryToConnectAll().catch((error: unknown) => {
    logError(error).error('Failed to refresh device aliases on startup');
  });
});
