import { TwinklyApiClient } from "./apiClient";
import { loadConfig } from "./config";
import { logger, logError } from './logger';

export interface Device {
  id: string;
  api_client: TwinklyApiClient;
  alias: string;
  effect_id: string | null;
}

const config = loadConfig();

// Initialize devices from config
export const devices: Record<string, Device> = Object.fromEntries(
  config.device.map((device, index) => [
    `twinkly-${index + 1}`,
    {
      id: `twinkly-${index + 1}`,
      alias: `Twinkly Device ${index + 1}`,
      api_client: new TwinklyApiClient(device.ip),
      effect_id: null,
    },
  ])
);

export async function refreshAliases(): Promise<void> {
    for (const device of Object.values(devices)) {
        try {   
            const gestalt = await device.api_client.gestalt();
            device.alias = gestalt.device_name || device.alias;
        } catch (error) {   
            logError(error).withMetadata({device_id: device.id}).error(`Failed to refresh alias for device`);
        }
    }
    logger.info('Device aliases refreshed');
}
