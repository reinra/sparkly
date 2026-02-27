import { backendClient, type GetInfoResponse } from '../FrontendApiClient';
import type { DeviceMode } from '@twinkly-ts/common';

// Shared device state
let devices = $state<GetInfoResponse['devices']>([]);
let effects = $state<GetInfoResponse['effects']>([]);
let deviceModes = $state<DeviceMode[]>([]);
let loading = $state(false);
let initialLoadDone = $state(false);
let error = $state('');

// Auto-rotate polling
let autoRotatePollTimer: ReturnType<typeof setInterval> | null = null;
const AUTO_ROTATE_POLL_INTERVAL_MS = 1000;

function hasAutoRotateActive(): boolean {
  return devices.some((d) =>
    d.parameters.some((p) => p.id === 'device.autoRotate' && p.type === 'boolean' && p.value === true)
  );
}

function updateAutoRotatePolling(): void {
  const shouldPoll = hasAutoRotateActive();
  if (shouldPoll && !autoRotatePollTimer) {
    autoRotatePollTimer = setInterval(async () => {
      try {
        const response = await backendClient.getInfo();
        if (response.status === 200) {
          devices = response.body.devices;
          effects = response.body.effects;
          // Stop polling if no longer needed
          if (!hasAutoRotateActive()) {
            stopAutoRotatePolling();
          }
        }
      } catch (e) {
        console.error('Auto-rotate poll failed:', e);
      }
    }, AUTO_ROTATE_POLL_INTERVAL_MS);
  } else if (!shouldPoll && autoRotatePollTimer) {
    stopAutoRotatePolling();
  }
}

function stopAutoRotatePolling(): void {
  if (autoRotatePollTimer) {
    clearInterval(autoRotatePollTimer);
    autoRotatePollTimer = null;
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
        updateAutoRotatePolling();
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
        updateAutoRotatePolling();
      }
    } catch (e) {
      console.error('Failed to refresh device:', e);
    }
  },

  getDevice(deviceId: string) {
    return devices.find((d) => d.id === deviceId) || null;
  },
};
