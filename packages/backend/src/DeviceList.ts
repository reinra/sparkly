import { TwinklyApiClient, DeviceUnreachableError } from './deviceClient/ApiClient';
import { loadConfig, addDeviceToConfig, removeDeviceFromConfig } from './config';
import { logger, logError } from './logger';
import { DeviceHelper, ConnectionStatus } from './DeviceHelper';
import { discoverDevicesOnNetwork } from './deviceClient/Discovery';
import type { DiscoveredDevice } from '@twinkly-ts/common';

const config = loadConfig();

// Initialize devices from config
export const devices: Record<string, DeviceHelper> = Object.fromEntries(
  config.device.map((device, index) => {
    const id = `twinkly-${index + 1}`;
    return [id, new DeviceHelper(id, new TwinklyApiClient(device.ip), `Twinkly Device ${index + 1}`)];
  })
);

const RECONNECT_INTERVAL_MS = 30_000; // 30 seconds between reconnect attempts
let reconnectTimer: ReturnType<typeof setInterval> | null = null;

export async function tryToConnectAll(): Promise<void> {
  for (const device of Object.values(devices)) {
    await tryConnectDevice(device);
  }
  const onlineCount = Object.values(devices).filter((d) => d.isOnline()).length;
  const totalCount = Object.values(devices).length;
  logger.info(`Device initialization complete: ${onlineCount}/${totalCount} online`);
  startReconnectLoop();
}

async function tryConnectDevice(device: DeviceHelper): Promise<boolean> {
  device.connectionStatus = ConnectionStatus.CONNECTING;
  try {
    const gestalt = await device.apiClient.gestalt();
    device.alias = gestalt.device_name || device.alias;
    await device.refreshFromDevice();
    device.connectionStatus = ConnectionStatus.ONLINE;
    return true;
  } catch {
    device.connectionStatus = ConnectionStatus.OFFLINE;
    logger
      .withMetadata({ device_id: device.id, ip: device.apiClient.getIp() })
      .warn(`Device ${device.id} is unreachable at ${device.apiClient.getIp()}`);
    return false;
  }
}

/** Reconnect a specific device. Returns true if successfully reconnected. */
export async function reconnectDevice(deviceId: string): Promise<boolean> {
  const device = devices[deviceId];
  if (!device) return false;
  if (device.isOnline()) return true;
  logger.withMetadata({ device_id: deviceId }).info(`Attempting manual reconnect for device ${deviceId}`);
  return tryConnectDevice(device);
}

function startReconnectLoop(): void {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(async () => {
    const offlineDevices = Object.values(devices).filter(
      (d) => d.connectionStatus === ConnectionStatus.OFFLINE || d.connectionStatus === ConnectionStatus.CONNECTING
    );
    if (offlineDevices.length === 0) return;

    logger.debug(`Attempting reconnect for ${offlineDevices.length} offline device(s)`);
    for (const device of offlineDevices) {
      const reconnected = await tryConnectDevice(device);
      if (reconnected) {
        logger
          .withMetadata({ device_id: device.id, ip: device.apiClient.getIp() })
          .info(`Device ${device.id} reconnected successfully`);
      }
    }
  }, RECONNECT_INTERVAL_MS);
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
    throw new AddDeviceError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Assign next ID and register the device
  const nextIndex = Object.keys(devices).length + 1;
  const deviceId = `twinkly-${nextIndex}`;
  const helper = new DeviceHelper(deviceId, probeClient, deviceName);
  helper.alias = deviceName;
  helper.connectionStatus = ConnectionStatus.ONLINE;
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

/**
 * Remove a device from the in-memory device list and persist the change to config.toml.
 * Throws RemoveDeviceError if the device is not found.
 */
export function removeDevice(deviceId: string): void {
  const device = devices[deviceId];
  if (!device) {
    throw new RemoveDeviceError(`Device with ID ${deviceId} not found.`);
  }

  const ip = device.apiClient.getIp();
  delete devices[deviceId];

  try {
    removeDeviceFromConfig(ip);
    logger.info(`Removed device ${deviceId} (${ip}) from config.toml`);
  } catch (err) {
    logError(err).error('Failed to remove device from config.toml (device removed in-memory only)');
  }

  logger.info(`Removed device ${deviceId}`);
}

export class RemoveDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoveDeviceError';
  }
}

/**
 * Broadcast UDP discovery, enrich each result with gestalt() for the device name,
 * and mark which devices are already configured.
 */
export async function discoverDevices(): Promise<DiscoveredDevice[]> {
  const rawResults = await discoverDevicesOnNetwork();

  const configuredIps = new Set(Object.values(devices).map((d) => d.apiClient.getIp()));

  const enriched: DiscoveredDevice[] = [];

  for (const raw of rawResults) {
    let deviceName = 'Twinkly Device';
    let ledCount: number | undefined;
    try {
      const probeClient = new TwinklyApiClient(raw.ip);
      const gestalt = await probeClient.gestalt();
      deviceName = gestalt.device_name || deviceName;
      ledCount = gestalt.number_of_led;
    } catch (error) {
      logError(error).debug(`Could not fetch gestalt for discovered device at ${raw.ip}`);
    }

    enriched.push({
      ip: raw.ip,
      deviceId: raw.deviceId,
      deviceName,
      ledCount,
      alreadyAdded: configuredIps.has(raw.ip),
    });
  }

  return enriched;
}
