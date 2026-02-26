import { TwinklyApiClient } from './deviceClient/ApiClient';
import { loadConfig } from './config';
import { logger, logError } from './logger';
import { DeviceHelper } from './DeviceHelper';

const config = loadConfig();

// Initialize devices from config
export const devices: Record<string, DeviceHelper> = Object.fromEntries(
  config.device.map((device, index) => {
    const id = `twinkly-${index + 1}`;
    return [id, new DeviceHelper(id, new TwinklyApiClient(device.ip), `Twinkly Device ${index + 1}`)];
  })
);

export async function tryToConnectAll(): Promise<void> {
  for (const device of Object.values(devices)) {
    try {
      const gestalt = await device.apiClient.gestalt();
      device.alias = gestalt.device_name || device.alias;

      await device.refreshFromDevice();
    } catch (error) {
      logError(error).withMetadata({ device_id: device.id }).error(`Failed to connect to device ${device.id}`);
    }
  }
  logger.info('Device aliases refreshed');
}
