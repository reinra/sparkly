import { TwinklyApiClient } from './deviceClient/apiClient';
import { loadConfig } from './config';
import type { FrameBuffer } from './render/FrameOutputStream';
import { logger, logError } from './logger';
import { DeviceHelper } from './DeviceHelper';

export interface Device {
  id: string;
  api_client: TwinklyApiClient;
  helper: DeviceHelper;
  alias: string;
  buffer: FrameBuffer;
}

const config = loadConfig();

// Initialize devices from config
export const devices: Record<string, Device> = Object.fromEntries(
  config.device.map((device, index) => {
    const apiClient = new TwinklyApiClient(device.ip);
    return [
      `twinkly-${index + 1}`,
      {
        id: `twinkly-${index + 1}`,
        alias: `Twinkly Device ${index + 1}`,
        api_client: apiClient,
        helper: new DeviceHelper(apiClient),
        buffer: { base64_encoded: null },
      },
    ];
  })
);

export async function tryToConnectAll(): Promise<void> {
  for (const device of Object.values(devices)) {
    try {
      const gestalt = await device.api_client.gestalt();
      device.alias = gestalt.device_name || device.alias;

      await device.helper.refreshFromDevice();
    } catch (error) {
      logError(error).withMetadata({ device_id: device.id }).error(`Failed to connect to device ${device.id}`);
    }
  }
  logger.info('Device aliases refreshed');
}
