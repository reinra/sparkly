import express from 'express';
import cors from 'cors';
import { TwinklyApiClient, DeviceUnreachableError } from './apiClient';
import { loadConfig } from './config';
import { logger, logError, withMeta } from './logger';
import { Mode } from '../apiContract';
import { backendApiContract } from './backendApiContract';
import { z } from 'zod';
import { effects } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { AnyEffectRenderer } from './effects/Renderer';
import { type LedMapper, IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper } from './effects/LedMapper';
import { registerRoutes } from './typedHandler';

const config = loadConfig();
// Use the first device for now
const apiClient = new TwinklyApiClient(config.device[0].ip);

const renderer = new AnyEffectRenderer();

interface Device {
  id: string;
  alias: string;
  apiClient: TwinklyApiClient;
  effect_id: string | null;
}
// Initialize devices from config
const devices: Record<string, Device> = Object.fromEntries(
  config.device.map((device, index) => [
    `twinkly-${index + 1}`,
    {
      id: `twinkly-${index + 1}`,
      alias: `Twinkly Device ${index + 1}`,
      apiClient: new TwinklyApiClient(device.ip),
      effect_id: null,
    },
  ])
);

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

async function prepareLedMapping(device: Device) {
  const ledConfig = await device.apiClient.getLedConfig();

  let mapper: LedMapper = new IdentityLedMapper();
  if (ledConfig.strings.length === 2) {
    const halfLength = ledConfig.strings[0].length;
    mapper = new SegmentedLedMapper([
      { startIndex: 0, mapper: new ReverseLedMapper(halfLength) },
      { startIndex: halfLength, mapper: new IdentityLedMapper() },
    ]);
  }
  return mapper;
}

// Register all API routes
registerRoutes(app, backendApiContract, {
  hello: (req, res) => {
    res.json({
      message: 'Hello from Twinkly Backend!',
    });
  },

  getInfo: async (req, res) => {
    const deviceList = [];
    for (const device of Object.values(devices)) {
      let gestalt = null;
      try {
        gestalt = await device.apiClient.gestalt();
      } catch (error) {
        logError(error).error(`Error fetching gestalt for device ${device.id}`);
      }
      let summary = null;
      try {
        summary = await device.apiClient.getSummary();
      } catch (error) {
        logError(error).error(`Error fetching summary for device ${device.id}`);
      }

      deviceList.push({
        id: device.id,
        alias: device.alias,
        ip: device.apiClient.getIp(),
        name: gestalt?.device_name,
        led_count: gestalt?.number_of_led,
        brightness: summary?.filters?.find((filter) => filter.filter == 'brightness')?.config?.value,
        mode: summary?.led_mode?.mode,
        effect_id: device.effect_id,
      });
    }

    res.json({
      devices: deviceList,
      effects: Object.entries(effects).map(([id, effect]) => ({
        id,
        name: effect.getName(),
      })),
    });
  },

  status: async (req, res) => {
    const gestalt = await apiClient.gestalt();
    const summary = await apiClient.getSummary();
    const ledConfig = await apiClient.getLedConfig();

    res.json({
      device: gestalt,
      summary: summary,
      ledConfig: ledConfig,
    });
  },

  setMode: async (req, res) => {
    const { device_id, mode } = req.body;
    const device = getDeviceOrError(device_id);
    await device.apiClient.setMode(mode);

    res.json({
      success: true,
      mode,
    });
  },

  setBrightness: async (req, res) => {
    const { device_id, brightness } = req.body;
    const device = getDeviceOrError(device_id);
    await device.apiClient.setBrightnessAbsolute(brightness);

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
          const ledMapper = await prepareLedMapping(device);
          await device.apiClient.setMode(Mode.rt);
          await renderer.render(effect, device.apiClient, ledMapper, signal);
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
});

app.listen(PORT, () => {
  logger.info(`Backend server running on http://localhost:${PORT}`);
});
