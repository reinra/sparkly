<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../frontendApiClient';
  import { handleApiUpdate } from '../utils/apiHelper';
  import DeviceBufferViewer from './DeviceBufferViewer.svelte';

  interface Props {
    device: GetInfoResponse['devices'][0];
    effects: GetInfoResponse['effects'];
  }

  let { device, effects }: Props = $props();
  let brightness = $derived(device.brightness);
  let mode = $derived(device.mode);
  let effect_id = $derived(device.effect_id);
  let updating = $state(false);

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
      () => {
        device.brightness = value;
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
      () => {
        device.mode = value as any;
      },
      () => {
        mode = device.mode;
      }
    );
    updating = false;
  }

  async function updateEffect(event: Event & { currentTarget: HTMLSelectElement }) {
    const value = event.currentTarget.value || null;
    if (updating || value === device.effect_id) return;

    updating = true;
    const success = await handleApiUpdate(
      () =>
        backendClient.chooseEffect({
          body: {
            device_id: device.id,
            effect_id: value,
          },
        }),
      () => {
        device.effect_id = value;
      },
      () => {
        effect_id = device.effect_id;
      }
    );
    updating = false;
  }

  async function sendMovie() {
    if (updating || !effect_id) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.sendMovie({
          body: {
            device_id: device.id,
            effect_id: effect_id!,
          },
        }),
      () => {},
      () => {}
    );
    updating = false;
  }
</script>

<div class="device-card">
  <a href="/devices/{device.id}" class="device-title">
    <h3>{device.alias}</h3>
  </a>
  <div class="device-info">
    <p><strong>ID:</strong> {device.id}</p>
    <p><strong>IP:</strong> {device.ip}</p>
    {#if device.name}
      <p><strong>Name:</strong> {device.name}</p>
    {/if}
    {#if device.led_count}
      <p><strong>LED Count:</strong> {device.led_count}</p>
    {/if}
    <p><strong>Brightness:</strong> {brightness}%</p>
    <input type="range" min="0" max="100" bind:value={brightness} onchange={updateBrightness} disabled={updating} />
    {#if device.mode}
      <p>
        <strong>Mode:</strong>
        <select bind:value={mode} onchange={updateMode} disabled={updating}>
          <option value="off">Off</option>
          <option value="demo">Demo</option>
          <option value="effect">Effect</option>
          <option value="movie">Movie</option>
          <option value="rt">RT</option>
        </select>
      </p>
    {/if}
    <p>
      <strong>Effect:</strong>
      <select bind:value={effect_id} onchange={updateEffect} disabled={updating}>
        <option value={null}>(None)</option>
        {#each effects as effect}
          <option value={effect.id}>{effect.id}</option>
        {/each}
      </select>
    </p>
    <button onclick={sendMovie} disabled={updating || !effect_id}>Send movie</button>
    <DeviceBufferViewer deviceId={device.id} />
  </div>
</div>

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

  .device-title {
    text-decoration: none;
    color: inherit;
    display: block;
  }

  .device-card h3 {
    color: #ff3e00;
    margin: 0 0 1rem 0;
    font-size: 1.3rem;
    transition: color 0.2s;
  }

  .device-title:hover h3 {
    color: #e63900;
    text-decoration: underline;
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
</style>