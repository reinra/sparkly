<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../FrontendApiClient';
  import { handleApiUpdate } from '../utils/ApiHelper';
  import DeviceBufferViewer from './DeviceBufferViewer.svelte';
  import SendMovieDialog from './SendMovieDialog.svelte';
  import RemoveDeviceDialog from './RemoveDeviceDialog.svelte';
  import { deviceStore } from '../stores/DeviceStore.svelte';
  import { groupEffectsByCategory } from '../utils/EffectGrouping';

  interface Props {
    device: GetInfoResponse['devices'][0];
    effects: GetInfoResponse['effects'];
  }

  let { device, effects }: Props = $props();
  let brightness = $derived(device.brightness);
  let mode = $derived(device.mode);
  let effect = $derived(device.effect);
  let deviceModes = $derived(deviceStore.deviceModes);
  let isOnline = $derived(deviceStore.isOnline(device));
  let isOffline = $derived(deviceStore.isOffline(device));
  let isConnecting = $derived(deviceStore.isConnecting(device));
  let updating = $state(false);
  let reconnecting = $state(false);
  let showMovieDialog = $state(false);
  let showRemoveDialog = $state(false);

  async function updateBrightness(event: Event & { currentTarget: HTMLInputElement }) {
    const value = Number(event.currentTarget.value);
    if (updating || value === device.brightness) return;

    updating = true;
    const success = await handleApiUpdate(
      () =>
        backendClient.setBrightness({
          body: {
            device_id: device.id,
            brightness: value,
          },
        }),
      async () => {
        await deviceStore.fetchDevice(device.id);
      },
      () => {
        brightness = device.brightness;
      }
    );
    updating = false;
  }

  async function updateMode(event: Event & { currentTarget: HTMLSelectElement }) {
    const value = event.currentTarget.value;
    if (updating || value === device.mode) return;

    updating = true;
    const success = await handleApiUpdate(
      () =>
        backendClient.setMode({
          body: {
            device_id: device.id,
            mode: value as any,
          },
        }),
      async () => {
        await deviceStore.fetchDevice(device.id);
      },
      () => {
        mode = device.mode;
      }
    );
    updating = false;
  }

  async function updateEffect(event: Event & { currentTarget: HTMLSelectElement }) {
    const value = event.currentTarget.value || null;
    if (updating || value === device.effect?.id) return;

    updating = true;
    const success = await handleApiUpdate(
      () =>
        backendClient.chooseEffect({
          body: {
            device_id: device.id,
            effect_id: value,
          },
        }),
      async () => {
        await deviceStore.fetchDevice(device.id);
      },
      () => {
        effect = device.effect;
      }
    );
    updating = false;
  }

  async function sendMovie() {
    if (updating || !effect) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.sendMovie({
          body: {
            device_id: device.id,
            effect_id: effect!.id,
          },
        }),
      async () => {
        showMovieDialog = true;
      },
      () => {}
    );
    updating = false;
  }

  function closeMovieDialog() {
    showMovieDialog = false;
    deviceStore.fetchDevice(device.id);
  }

  function handleRemoveDialogClose(removed: boolean) {
    showRemoveDialog = false;
    if (removed) {
      deviceStore.fetchAllDevices();
    }
  }

  async function reconnect() {
    if (reconnecting) return;
    reconnecting = true;
    await deviceStore.reconnectDevice(device.id);
    reconnecting = false;
  }
</script>

<div class="device-card" class:device-offline={isOffline} class:device-connecting={isConnecting}>
  <div class="device-header">
    <div class="device-header-top">
      <h3 class="device-title"><a href="/devices/{device.id}">{device.alias}</a></h3>
      <button class="remove-icon-button" onclick={() => (showRemoveDialog = true)} title="Remove device">
        &#10005;
      </button>
    </div>
    <div class="device-header-status">
      <span
        class="status-indicator"
        class:online={isOnline}
        class:offline={isOffline}
        class:connecting={isConnecting}
        title={device.connectionStatus}
      ></span>
      <span class="status-label" class:online={isOnline} class:offline={isOffline} class:connecting={isConnecting}>
        {isOnline ? 'Online' : isOffline ? 'Disconnected' : 'Connecting'}
      </span>
      <a href="/devices/{device.id}" class="details-button">Details</a>
    </div>
  </div>
  {#if !isOnline}
    <div class="offline-banner">
      {#if device.led_count}
        <p><strong>LED Count:</strong> {device.led_count}</p>
      {/if}
      <p>{isConnecting ? `Connecting to ${device.ip}...` : `Device unreachable at ${device.ip}`}</p>
      {#if !isConnecting}
        <button class="reconnect-button" onclick={reconnect} disabled={reconnecting}>
          {reconnecting ? 'Reconnecting...' : 'Reconnect'}
        </button>
      {/if}
    </div>
  {:else}
    <div class="device-info">
      <p><strong>IP:</strong> {device.ip}</p>
      {#if device.led_count}
        <p><strong>LED Count:</strong> {device.led_count}</p>
      {/if}
      <p><strong>Brightness:</strong> {brightness}%</p>
      <input type="range" min="0" max="100" value={brightness} onchange={updateBrightness} disabled={updating} />
      {#if device.mode}
        <p>
          <strong>Mode:</strong>
          <select value={mode} onchange={updateMode} disabled={updating}>
            {#each deviceModes as dm}
              <option value={dm.key}>{dm.title}</option>
            {/each}
          </select>
        </p>
      {/if}
      <p>
        <strong>Effect:</strong>
        <select value={effect?.id} onchange={updateEffect} disabled={updating}>
          <option value={null}>(None)</option>
          {#each groupEffectsByCategory(effects, deviceStore.effectCategories) as group}
            <optgroup label={group.label}>
              {#each group.effects as eff}
                <option value={eff.id}>{eff.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </p>
      {#if effect}
        <div class="effect-info">
          <h4>Effect Info</h4>
          <p><strong>ID:</strong> {effect.id}</p>
          <p><strong>Name:</strong> {effect.name}</p>
          <p><strong>Type:</strong> {effect.type}</p>
          <p><strong>Point Type:</strong> {effect.pointType}</p>
          {#if effect.loop_duration_seconds != null}
            <p><strong>Loop Duration:</strong> {effect.loop_duration_seconds.toFixed(2)}s</p>
          {/if}
        </div>
      {/if}
      <button onclick={sendMovie} disabled={updating || !effect}>Send movie</button>
      <DeviceBufferViewer deviceId={device.id} disableLive={showMovieDialog} />
    </div>
  {/if}
</div>

{#if showMovieDialog}
  <SendMovieDialog deviceId={device.id} onclose={closeMovieDialog} />
{/if}

{#if showRemoveDialog}
  <RemoveDeviceDialog
    deviceId={device.id}
    deviceAlias={device.alias}
    deviceIp={device.ip}
    onclose={handleRemoveDialogClose}
  />
{/if}

<style>
  .device-card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .device-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .device-card.device-offline {
    border-left: 4px solid #d32f2f;
    opacity: 0.85;
  }

  .device-card.device-connecting {
    border-left: 4px solid #d32f2f;
    opacity: 0.85;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-indicator.online {
    background: #4caf50;
    box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
  }

  .status-indicator.offline {
    background: #d32f2f;
    box-shadow: 0 0 4px rgba(211, 47, 47, 0.5);
  }

  .status-indicator.connecting {
    background: #f9a825;
    box-shadow: 0 0 4px rgba(249, 168, 37, 0.5);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .status-label {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
  }

  .status-label.offline,
  .status-label.connecting {
    background: #d32f2f;
    color: white;
  }

  .status-label.online {
    background: #e8f5e9;
    color: #2e7d32;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .offline-banner {
    text-align: center;
    padding: 1rem;
    color: #666;
  }

  .offline-banner p {
    margin: 0 0 0.75rem 0;
    color: #666;
    font-size: 0.9rem;
  }

  .offline-banner p:last-of-type {
    color: #d32f2f;
  }

  .reconnect-button {
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .reconnect-button:hover:not(:disabled) {
    background: #1565c0;
  }

  .reconnect-button:disabled {
    background: #90caf9;
    cursor: not-allowed;
  }

  .device-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .device-header-top {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .device-header-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .device-card h3 {
    color: #ff3e00;
    margin: 0;
    font-size: 1.3rem;
    transition: color 0.2s;
  }

  .device-title {
    font-weight: 600;
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  .device-title a {
    color: inherit;
    text-decoration: none;
  }

  .details-button {
    text-decoration: none;
    color: white;
    background: #0f9d58;
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    transition: background 0.2s;
  }

  .details-button:hover {
    background: #0a7d45;
  }

  .remove-icon-button {
    background: none;
    border: none;
    color: #999;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
    margin: 0;
    margin-left: 0.5rem;
    line-height: 1;
    font-weight: normal;
  }

  .remove-icon-button:hover {
    color: #d32f2f;
    background: #ffebee;
    transform: none;
    box-shadow: none;
  }

  .device-title:hover {
    color: #e63900;
  }

  .device-info p {
    margin: 0.5rem 0;
    color: #666;
  }

  button {
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.2rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    margin-top: 1rem;
    transition: all 0.2s;
  }

  button:hover:not(:disabled) {
    background: #e63900;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 62, 0, 0.3);
  }

  button:active:not(:disabled) {
    transform: translateY(0);
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .effect-info {
    background: #f8f8f8;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .effect-info h4 {
    margin: 0 0 0.5rem 0;
    color: #ff3e00;
    font-size: 1rem;
  }

  .effect-info p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }
</style>
