<script lang="ts">
  import { backendClient } from '../../../frontendApiClient';
  import { handleApiUpdate } from '../../../utils/apiHelper';
  import DeviceBufferViewer from '../../../components/DeviceBufferViewer.svelte';
  import EffectParameters from '../../../components/EffectParameters.svelte';
  import { deviceStore } from '../../../stores/deviceStore.svelte';
  import { page } from '$app/state';
  import { ParameterType, type EffectParameter } from '@twinkly-ts/common';

  let deviceId = $derived(page.params.id);
  let device = $derived(deviceStore.getDevice(deviceId));
  let effects = $derived(deviceStore.effects);
  let updating = $state(false);
  let selectedEffectIndex = $state(0);
  let effectElements: HTMLButtonElement[] = [];

  // Fetch devices on mount or when device ID changes
  $effect(() => {
    if (deviceStore.devices.length === 0) {
      deviceStore.fetchAllDevices();
    } else {
      // Only fetch when deviceId changes, not when devices array updates
      deviceStore.fetchDevice(deviceId);
    }
  });

  $effect(() => {
    // Scroll selected effect into view
    if (effectElements[selectedEffectIndex]) {
      effectElements[selectedEffectIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  });

  $effect(() => {
    // Set selected effect index based on current effect
    if (device && device.effect_id && effects.length > 0) {
      const idx = effects.findIndex((e) => e.id === device.effect_id);
      if (idx >= 0) selectedEffectIndex = idx;
    }
  });

  async function updateMode(event: Event & { currentTarget: HTMLSelectElement }) {
    if (!device || updating) return;
    const value = event.currentTarget.value;
    if (value === device.mode) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.setMode({
          body: {
            device_id: deviceId,
            mode: value as any,
          },
        }),
      async () => {
        await deviceStore.fetchDevice(deviceId);
      },
      () => {}
    );
    updating = false;
  }

  async function selectEffect(index: number) {
    if (!device || updating || index < 0 || index >= effects.length) return;
    const effect = effects[index];
    if (device.effect_id === effect.id) return;

    selectedEffectIndex = index;
    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.chooseEffect({
          body: {
            device_id: deviceId,
            effect_id: effect.id,
          },
        }),
      async () => {
        await deviceStore.fetchDevice(deviceId);
      },
      () => {}
    );
    updating = false;
  }

  async function sendMovie() {
    if (!device || updating || !device.effect_id) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.sendMovie({
          body: {
            device_id: deviceId,
            effect_id: device.effect_id!,
          },
        }),
      async () => {
        // Refresh device state
        await deviceStore.fetchDevice(deviceId);
      },
      () => {}
    );
    updating = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!effects.length || updating) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const newIndex = Math.min(selectedEffectIndex + 1, effects.length - 1);
      selectEffect(newIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const newIndex = Math.max(selectedEffectIndex - 1, 0);
      selectEffect(newIndex);
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="device-detail">
  {#if deviceStore.loading}
    <p class="loading">Loading device...</p>
  {:else if deviceStore.error}
    <p class="error">{deviceStore.error}</p>
  {:else if device}
    <div class="header">
      <a href="/devices" class="back-button">← Back to Devices</a>
      <h2>{device.alias}</h2>
    </div>

    <div class="device-content">
      <div class="device-info-section">
        <h3>Device Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <strong>ID:</strong>
            <span>{device.id}</span>
          </div>
          <div class="info-item">
            <strong>IP:</strong>
            <span>{device.ip}</span>
          </div>
          {#if device.name}
            <div class="info-item">
              <strong>Name:</strong>
              <span>{device.name}</span>
            </div>
          {/if}
          {#if device.led_count}
            <div class="info-item">
              <strong>LED Count:</strong>
              <span>{device.led_count}</span>
            </div>
          {/if}
        </div>

        {#if device.mode}
          <div class="control-group">
            <label for="mode">
              <strong>Mode:</strong>
            </label>
            <select id="mode" value={device.mode} onchange={updateMode} disabled={updating}>
              <option value="off">Off</option>
              <option value="demo">Demo</option>
              <option value="effect">Effect</option>
              <option value="movie">Movie</option>
              <option value="rt">RT</option>
            </select>
          </div>
        {/if}

        <EffectParameters deviceId={device.id} parameters={device.parameters || []} bind:updating />

        <button onclick={sendMovie} disabled={updating || !device.effect_id}> Send Movie </button>
      </div>

      <div class="effects-section">
        <h3>Effects</h3>
        <p class="hint">Use ↑↓ arrow keys to navigate</p>
        <div class="effects-list">
          {#each effects as effect, index}
            <button
              bind:this={effectElements[index]}
              class="effect-item"
              class:selected={index === selectedEffectIndex}
              class:active={device.effect_id === effect.id}
              onclick={() => selectEffect(index)}
              disabled={updating}
            >
              <span class="effect-name">{effect.id}</span>
              {#if device.effect_id === effect.id}
                <span class="active-badge">Active</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="buffer-section">
      <DeviceBufferViewer deviceId={device.id} />
    </div>
  {:else}
    <p class="error">Device not found</p>
    <a href="/devices" class="back-button">← Back to Devices</a>
  {/if}
</div>

<style>
  .device-detail {
    max-width: 1200px;
    padding: 1rem;
  }

  .header {
    margin-bottom: 2rem;
  }

  .back-button {
    display: inline-block;
    color: #ff3e00;
    text-decoration: none;
    margin-bottom: 1rem;
    font-weight: 500;
    transition: color 0.2s;
  }

  .back-button:hover {
    color: #e63900;
  }

  h2 {
    color: #333;
    font-size: 2rem;
    margin: 0;
  }

  h3 {
    color: #ff3e00;
    font-size: 1.4rem;
    margin: 0 0 1rem 0;
  }

  h4 {
    color: #ff3e00;
    font-size: 1.1rem;
    margin: 1.5rem 0 1rem 0;
  }

  .device-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .device-info-section,
  .effects-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-item strong {
    color: #666;
    font-size: 0.9rem;
  }

  .info-item span {
    color: #333;
    font-size: 1.1rem;
  }

  .control-group {
    margin-bottom: 1.5rem;
  }

  .control-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
  }

  input[type='range'] {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #ddd;
    outline: none;
    margin-top: 0.5rem;
  }

  input[type='range']:disabled {
    opacity: 0.5;
  }

  select {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    color: #333;
    font-size: 1rem;
    cursor: pointer;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint {
    color: #999;
    font-size: 0.9rem;
    font-style: italic;
    margin: -0.5rem 0 1rem 0;
  }

  .effects-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 500px;
    overflow-y: auto;
  }

  .effect-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f8f8f8;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 1rem;
    color: #333;
  }

  .effect-item:hover:not(:disabled) {
    background: #f0f0f0;
    border-color: #ff3e00;
  }

  .effect-item.selected {
    border-color: #ff3e00;
    background: #fff5f3;
  }

  .effect-item.active {
    background: #ff3e00;
    color: white;
  }

  .effect-item.active:hover:not(:disabled) {
    background: #e63900;
  }

  .effect-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .effect-name {
    font-weight: 500;
  }

  .active-badge {
    background: rgba(255, 255, 255, 0.3);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .buffer-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  button {
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
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

  .loading,
  .error {
    padding: 2rem;
    text-align: center;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .loading {
    color: #666;
    font-style: italic;
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
  }

  @media (max-width: 768px) {
    .device-content {
      grid-template-columns: 1fr;
    }
  }
</style>
