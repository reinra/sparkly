<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../frontendApiClient';
  import { handleApiUpdate } from '../utils/apiHelper';

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
        device.mode = value;
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
</script>

<div class="device-card">
  <h3>{device.alias}</h3>
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

  .device-card h3 {
    color: #ff3e00;
    margin: 0 0 1rem 0;
    font-size: 1.3rem;
  }

  .device-info p {
    margin: 0.5rem 0;
    color: #666;
  }
</style>
