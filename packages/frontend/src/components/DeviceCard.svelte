<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../FrontendApiClient';
  import { handleApiUpdate } from '../utils/ApiHelper';
  import DeviceBufferViewer from './DeviceBufferViewer.svelte';
  import SendMovieDialog from './SendMovieDialog.svelte';
  import RemoveDeviceDialog from './RemoveDeviceDialog.svelte';
  import { deviceStore } from '../stores/DeviceStore.svelte';

  interface Props {
    device: GetInfoResponse['devices'][0];
    effects: GetInfoResponse['effects'];
  }

  let { device, effects }: Props = $props();
  let brightness = $derived(device.brightness);
  let mode = $derived(device.mode);
  let effect = $derived(device.effect);
  let deviceModes = $derived(deviceStore.deviceModes);
  let updating = $state(false);
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
</script>

<div class="device-card">
  <div class="device-header">
    <h3 class="device-title"><a href="/devices/{device.id}">{device.alias}</a></h3>
    <a href="/devices/{device.id}" class="details-button">Details</a>
    <button class="remove-icon-button" onclick={() => (showRemoveDialog = true)} title="Remove device">
      &#10005;
    </button>
  </div>
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
        {#each effects as eff}
          <option value={eff.id}>{eff.name}</option>
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

  .device-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .device-card h3 {
    color: #ff3e00;
    margin: 0;
    font-size: 1.3rem;
    transition: color 0.2s;
  }

  .device-title {
    font-weight: 600;
  }

  .device-title a {
    color: inherit;
    text-decoration: none;
  }

  .details-button {
    margin-left: auto;
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
