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
  let deviceModes = $derived(deviceStore.deviceModes);
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
    if (!device || index < 0 || index >= effects.length) return;
    const effect = effects[index];

    // Update visual selection immediately
    selectedEffectIndex = index;

    // Only call backend if effect actually changed
    if (device.effect_id === effect.id) return;

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
    if (!effects.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();

      const newIndex =
        event.key === 'ArrowDown'
          ? Math.min(selectedEffectIndex + 1, effects.length - 1)
          : Math.max(selectedEffectIndex - 1, 0);

      selectEffect(newIndex);
      // Keep focus on the newly selected effect button
      setTimeout(() => effectElements[newIndex]?.focus(), 0);
    }
  }
</script>

<div class="device-detail">
  {#if deviceStore.loading}
    <p class="loading">Loading device...</p>
  {:else if deviceStore.error}
    <p class="error">{deviceStore.error}</p>
  {:else if device}
    <div class="device-content">
      <div class="device-info-section">
        <h3>Device Information</h3>
        <div class="info-list">
          {#if device.name}
            <div class="info-item">
              <strong>Name:</strong>
              <span>{device.name}</span>
            </div>
          {/if}
          <div class="info-item">
            <strong>IP:</strong>
            <span>{device.ip}</span>
          </div>
          {#if device.led_count}
            <div class="info-item">
              <strong>LED Count:</strong>
              <span>{device.led_count}</span>
            </div>
          {/if}
          {#if device.mode}
            <div class="info-item">
              <strong>Mode:</strong>
              <select id="mode" value={device.mode} onchange={updateMode} disabled={updating}>
                {#each deviceModes as dm}
                  <option value={dm.key}>{dm.title}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>

        <EffectParameters deviceId={device.id} parameters={device.parameters || []} bind:updating />

        <button onclick={sendMovie} disabled={updating || !device.effect_id}> Send Movie </button>
      </div>

      <div class="effects-section">
        <h3>Effects</h3>
        <p class="hint">Focus effects: ↑↓ to navigate | Focus params: ↑↓ to switch, ←→ to adjust</p>
        <div class="effects-list">
          {#each effects as effect, index}
            <button
              bind:this={effectElements[index]}
              class="effect-item"
              class:selected={index === selectedEffectIndex}
              class:active={device.effect_id === effect.id}
              onclick={() => selectEffect(index)}
              onkeydown={handleKeyDown}
              tabindex={index === selectedEffectIndex ? 0 : -1}
            >
              <span class="effect-name">{effect.id}</span>
              <span class="active-badge" class:visible={device.effect_id === effect.id}>Active</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="buffer-section">
        <DeviceBufferViewer deviceId={device.id} />
      </div>
    </div>
  {:else}
    <p class="error">Device not found</p>
    <a href="/devices" class="back-button">← Back to Devices</a>
  {/if}
</div>

<style>
  .device-detail {
    padding: 1rem 2rem;
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

  .device-content {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .device-info-section,
  .effects-section,
  .buffer-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .info-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .info-item strong {
    color: #666;
    font-size: 0.95rem;
    min-width: 120px;
    flex-shrink: 0;
  }

  .info-item span {
    color: #333;
    font-size: 1rem;
  }

  .info-item select {
    flex: 1;
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
    min-width: 0;
  }

  .effects-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 800px;
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
    white-space: nowrap;
  }

  .active-badge {
    background: rgba(255, 255, 255, 0.3);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    visibility: hidden;
  }

  .active-badge.visible {
    visibility: visible;
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

  /* Medium screens - 2 columns with buffer at bottom */
  @media (max-width: 1024px) {
    .device-content {
      grid-template-columns: 1fr 1fr;
    }

    .buffer-section {
      grid-column: 1 / -1;
    }
  }

  /* Small screens - single column */
  @media (max-width: 768px) {
    .device-content {
      grid-template-columns: 1fr;
    }
  }
</style>
