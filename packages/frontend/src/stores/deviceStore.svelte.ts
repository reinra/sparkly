import { backendClient, type GetInfoResponse } from '../frontendApiClient';
import type { DeviceMode } from '@twinkly-ts/common';

// Shared device state
let devices = $state<GetInfoResponse['devices']>([]);
let effects = $state<GetInfoResponse['effects']>([]);
let deviceModes = $state<DeviceMode[]>([]);
let loading = $state(false);
let error = $state('');

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
      } else {
        error = 'Failed to get info. Make sure config.toml is properly configured.';
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
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
      }
    } catch (e) {
      console.error('Failed to refresh device:', e);
    }
  },

  getDevice(deviceId: string) {
    return devices.find((d) => d.id === deviceId) || null;
  }
};
