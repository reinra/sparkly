import { TwinklyApiClient, DeviceUnreachableError } from './deviceClient/ApiClient';
import { loadConfig, addDeviceToConfig } from './config';
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

export interface AddDeviceResult {
  success: true;
  deviceId: string;
  deviceName: string;
}

/** Validate IP address format (IPv4). */
function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = Number(part);
    return Number.isInteger(num) && num >= 0 && num <= 255 && part === String(num);
  });
}

/**
 * Probe a Twinkly device at the given IP, add it to the in-memory device list,
 * and persist the IP to config.toml.
 *
 * Throws a descriptive error string on failure.
 */
export async function probeAndAddDevice(ip: string): Promise<AddDeviceResult> {
  const trimmedIp = ip.trim();

  // 1. Validate IP format
  if (!isValidIp(trimmedIp)) {
    throw new AddDeviceError('Invalid IP address format.');
  }

  // 2. Check for duplicate IP
  for (const device of Object.values(devices)) {
    if (device.apiClient.getIp() === trimmedIp) {
      throw new AddDeviceError(`A device with IP ${trimmedIp} is already configured (${device.alias}).`);
    }
  }

  // 3. Probe the device — attempt gestalt with a short timeout
  const probeClient = new TwinklyApiClient(trimmedIp);
  let deviceName: string;
  try {
    const gestalt = await probeClient.gestalt();
    deviceName = gestalt.device_name || 'Twinkly Device';
  } catch (error) {
    if (error instanceof DeviceUnreachableError) {
      throw new AddDeviceError(
        'Connection timed out. Verify the device is powered on and reachable from this network.'
      );
    }
    throw new AddDeviceError(
      `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 4. Assign next ID and register the device
  const nextIndex = Object.keys(devices).length + 1;
  const deviceId = `twinkly-${nextIndex}`;
  const helper = new DeviceHelper(deviceId, probeClient, deviceName);
  helper.alias = deviceName;
  devices[deviceId] = helper;

  // Refresh full device state in the background
  helper.refreshFromDevice().catch((err) => {
    logError(err).error(`Failed initial refresh for newly added device ${deviceId}`);
  });

  // 5. Persist to config.toml
  try {
    addDeviceToConfig(trimmedIp);
    logger.info(`Persisted new device ${deviceId} (${trimmedIp}) to config.toml`);
  } catch (err) {
    logError(err).error('Failed to persist new device to config.toml (device added in-memory only)');
  }

  logger.info(`Added new device ${deviceId}: ${deviceName} at ${trimmedIp}`);
  return { success: true, deviceId, deviceName };
}

export class AddDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddDeviceError';
  }
}
