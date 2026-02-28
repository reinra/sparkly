import { backendClient, type GetInfoResponse } from '../FrontendApiClient';
import { ConnectionStatus, type DeviceMode } from '@twinkly-ts/common';

// Shared device state
let devices = $state<GetInfoResponse['devices']>([]);
let effects = $state<GetInfoResponse['effects']>([]);
let deviceModes = $state<DeviceMode[]>([]);
let loading = $state(false);
let initialLoadDone = $state(false);
let error = $state('');

// Polling
let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentPollInterval: number | null = null;
const FAST_POLL_INTERVAL_MS = 1000;
const STATUS_POLL_INTERVAL_MS = 5000;

function hasAutoRotateActive(): boolean {
  return devices.some((d) =>
    d.parameters.some((p) => p.id === 'device.autoRotate' && p.type === 'boolean' && p.value === true)
  );
}

function hasOfflineDevices(): boolean {
  return devices.some((d) => d.connectionStatus !== ConnectionStatus.ONLINE);
}

async function pollDevices(): Promise<void> {
  try {
    const response = await backendClient.getInfo();
    if (response.status === 200) {
      devices = response.body.devices;
      effects = response.body.effects;
      updatePolling();
    }
  } catch (e) {
    console.error('Poll failed:', e);
  }
}

function updatePolling(): void {
  const needsFastPoll = hasAutoRotateActive();
  const needsStatusPoll = hasOfflineDevices();

  if (needsFastPoll) {
    startPolling(FAST_POLL_INTERVAL_MS);
  } else if (needsStatusPoll) {
    startPolling(STATUS_POLL_INTERVAL_MS);
  } else {
    stopPolling();
  }
}

function startPolling(intervalMs: number): void {
  if (currentPollInterval === intervalMs) return;
  stopPolling();
  pollTimer = setInterval(pollDevices, intervalMs);
  currentPollInterval = intervalMs;
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    currentPollInterval = null;
  }
}
export const deviceStore = {
  get devices() {
    return devices;
  },
  get effects() {
    return effects;
  },
  get loading() {
    return loading;
  },
  get initialLoadDone() {
    return initialLoadDone;
  },
  get error() {
    return error;
  },
  get deviceModes() {
    return deviceModes;
  },

  async fetchSystemInfo() {
    try {
      const response = await backendClient.getSystemInfo();
      if (response.status === 200) {
        deviceModes = response.body.deviceModes;
      }
    } catch (e) {
      console.error('Failed to fetch system info:', e);
    }
  },

  setDeviceModes(modes: DeviceMode[]) {
    deviceModes = modes;
  },

  async fetchAllDevices() {
    loading = true;
    error = '';
    try {
      const response = await backendClient.getInfo();
      if (response.status === 200) {
        devices = response.body.devices;
        effects = response.body.effects;
        updatePolling();
      } else {
        error = 'Failed to get info. Make sure config.toml is properly configured.';
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
      initialLoadDone = true;
    }
  },

  async fetchDevice(deviceId: string) {
    try {
      const response = await backendClient.getInfo({ query: { device_id: deviceId } });
      if (response.status === 200 && response.body.devices.length > 0) {
        const updatedDevice = response.body.devices[0];
        const index = devices.findIndex((d) => d.id === deviceId);

        if (index >= 0) {
          devices[index] = updatedDevice;
        } else {
          devices.push(updatedDevice);
        }

        // Update effects if they changed
        if (response.body.effects.length > 0) {
          effects = response.body.effects;
        }
        updatePolling();
      }
    } catch (e) {
      console.error('Failed to refresh device:', e);
    }
  },

  getDevice(deviceId: string) {
    return devices.find((d) => d.id === deviceId) || null;
  },

  isOnline(device: GetInfoResponse['devices'][0] | null | undefined): boolean {
    return device?.connectionStatus === ConnectionStatus.ONLINE;
  },

  isOffline(device: GetInfoResponse['devices'][0] | null | undefined): boolean {
    return device?.connectionStatus === ConnectionStatus.OFFLINE;
  },

  isConnecting(device: GetInfoResponse['devices'][0] | null | undefined): boolean {
    return device?.connectionStatus === ConnectionStatus.CONNECTING;
  },

  async renameEffect(effectId: string, name: string): Promise<{ id: string; name: string } | null> {
    try {
      const response = await backendClient.renameEffect({ body: { effect_id: effectId, name } });
      if (response.status === 200) {
        // Update local effects list reactively
        const idx = effects.findIndex((e) => e.id === effectId);
        if (idx >= 0) {
          effects[idx] = { ...effects[idx], name: response.body.name };
        }
        return response.body;
      }
    } catch (e) {
      console.error('Failed to rename effect:', e);
    }
    return null;
  },

  async reconnectDevice(deviceId: string): Promise<boolean> {
    try {
      const response = await backendClient.reconnectDevice({ body: { device_id: deviceId } });
      if (response.status === 200 && response.body.success) {
        await this.fetchDevice(deviceId);
        return true;
      }
    } catch (e) {
      console.error('Reconnect failed:', e);
    }
    return false;
  },
};
