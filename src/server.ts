import express from 'express';
import cors from 'cors';
import { TwinklyApiClient, DeviceUnreachableError } from './apiClient';
import { loadConfig } from './config';
import { Mode } from './apiContract';
import { backendApiContract } from './backendApiContract';
import { z } from 'zod';
import { effects } from './effects/EffectLibrary';
import { abortTask, startAndAbortPreviousTask } from './backendLoops';
import { AnyEffectRenderer } from './effects/Renderer';
import { type LedMapper, IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper } from './effects/LedMapper';

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

// Hello World endpoint
app.get('/api/hello', (req, res) => {
  const response = backendApiContract.hello.responses[200].parse({
    message: 'Hello from Twinkly Backend!',
  });
  res.json(response);
});

app.get('/api/info', async (req, res) => {
  const deviceList = [];
  for (const device of Object.values(devices)) {
    let gestalt = null;
    try {
      gestalt = await device.apiClient.gestalt();
    } catch (error) {
      console.error(`Error fetching gestalt for device ${device.id}:`, error);
    }
    let summary = null;
    try {
      summary = await device.apiClient.getSummary();
    } catch (error) {
      console.error(`Error fetching summary for device ${device.id}:`, error);
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

  const response = backendApiContract.getInfo.responses[200].parse({
    devices: deviceList,
    effects: Object.entries(effects).map(([id, effect]) => ({
      id,
      name: effect.getName(),
    })),
  });
  res.json(response);
});

// Get device status
app.get('/api/status', async (req, res) => {
  try {
    const gestalt = await apiClient.gestalt();
    const summary = await apiClient.getSummary();
    const ledConfig = await apiClient.getLedConfig();

    const response = backendApiContract.status.responses[200].parse({
      device: gestalt,
      summary: summary,
      ledConfig: ledConfig,
    });
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.errors);
    } else if (error instanceof DeviceUnreachableError) {
      console.error('Device unreachable:', error.message);
      const errorResponse = backendApiContract.status.responses[500].parse({
        error: error.message,
      });
      return res.status(503).json(errorResponse);
    } else {
      console.error('Error getting device status:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    const errorResponse = backendApiContract.status.responses[500].parse({
      error: 'Failed to get device status',
    });
    res.status(500).json(errorResponse);
  }
});

// Set mode endpoint
app.post('/api/mode', async (req, res) => {
  try {
    // Validate request body
    const validatedBody = backendApiContract.setMode.body.parse(req.body);
    const { device_id, mode } = validatedBody;
    const device = devices[device_id];
    if (!device) {
      const errorResponse = backendApiContract.setBrightness.responses[500].parse({
        error: `Device with ID ${device_id} not found`,
      });
      return res.status(404).json(errorResponse);
    }
    await device.apiClient.setMode(mode);

    const response = backendApiContract.setMode.responses[200].parse({
      success: true,
      mode,
    });
    res.json(response);
  } catch (error) {
    console.error('Error setting mode:', error);
    if (error instanceof z.ZodError) {
      const errorResponse = backendApiContract.setMode.responses[500].parse({
        error: 'Invalid request: ' + error.errors.map((e) => e.message).join(', '),
      });
      res.status(400).json(errorResponse);
    } else if (error instanceof DeviceUnreachableError) {
      const errorResponse = backendApiContract.setMode.responses[500].parse({
        error: error.message,
      });
      res.status(503).json(errorResponse);
    } else {
      const errorResponse = backendApiContract.setMode.responses[500].parse({
        error: 'Failed to set mode',
      });
      res.status(500).json(errorResponse);
    }
  }
});

app.post('/api/brightness', async (req, res) => {
  try {
    // Validate request body
    const validatedBody = backendApiContract.setBrightness.body.parse(req.body);
    const { device_id, brightness } = validatedBody;
    const device = devices[device_id];
    if (!device) {
      const errorResponse = backendApiContract.setBrightness.responses[500].parse({
        error: `Device with ID ${device_id} not found`,
      });
      return res.status(404).json(errorResponse);
    }
    await device.apiClient.setBrightnessAbsolute(brightness);

    const response = backendApiContract.setBrightness.responses[200].parse({
      success: true,
    });
    res.json(response);
  } catch (error) {
    console.error('Error setting brightness:', error);
    if (error instanceof z.ZodError) {
      const errorResponse = backendApiContract.setBrightness.responses[500].parse({
        error: 'Invalid request: ' + error.errors.map((e) => e.message).join(', '),
      });
      res.status(400).json(errorResponse);
    } else if (error instanceof DeviceUnreachableError) {
      const errorResponse = backendApiContract.setBrightness.responses[500].parse({
        error: error.message,
      });
      res.status(503).json(errorResponse);
    } else {
      const errorResponse = backendApiContract.setBrightness.responses[500].parse({
        error: 'Failed to set brightness',
      });
      res.status(500).json(errorResponse);
    }
  }
});

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

app.post('/api/effect', async (req, res) => {
  try {
    // Validate request body
    const validatedBody = backendApiContract.chooseEffect.body.parse(req.body);
    const { device_id, effect_id } = validatedBody;
    const device = devices[device_id];
    if (!device) {
      const errorResponse = backendApiContract.chooseEffect.responses[500].parse({
        error: `Device with ID ${device_id} not found`,
      });
      return res.status(404).json(errorResponse);
    }
    const taskKey = device_id;

    if (effect_id) {
      const effect = effects[effect_id];
      if (!effect) {
        const errorResponse = backendApiContract.chooseEffect.responses[500].parse({
          error: `Effect with ID ${effect_id} not found`,
        });
        return res.status(404).json(errorResponse);
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

    const response = backendApiContract.chooseEffect.responses[200].parse({
      success: true,
    });
    res.json(response);
  } catch (error) {
    console.error('Error choosing effect:', error);
    if (error instanceof z.ZodError) {
      const errorResponse = backendApiContract.chooseEffect.responses[500].parse({
        error: 'Invalid request: ' + error.errors.map((e) => e.message).join(', '),
      });
      res.status(400).json(errorResponse);
    } else if (error instanceof DeviceUnreachableError) {
      const errorResponse = backendApiContract.chooseEffect.responses[500].parse({
        error: error.message,
      });
      res.status(503).json(errorResponse);
    } else {
      const errorResponse = backendApiContract.chooseEffect.responses[500].parse({
        error: 'Failed to choose effect',
      });
      res.status(500).json(errorResponse);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
