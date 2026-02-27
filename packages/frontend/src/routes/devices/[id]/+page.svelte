<script lang="ts">
  import { backendClient } from '../../../FrontendApiClient';
  import { handleApiUpdate } from '../../../utils/ApiHelper';
  import DeviceBufferViewer from '../../../components/DeviceBufferViewer.svelte';
  import EffectParameters from '../../../components/EffectParameters.svelte';
  import SendMovieDialog from '../../../components/SendMovieDialog.svelte';
  import RemoveDeviceDialog from '../../../components/RemoveDeviceDialog.svelte';
  import { deviceStore } from '../../../stores/DeviceStore.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ParameterGroup } from '@twinkly-ts/common';

  let deviceId = $derived(page.params.id);
  let device = $derived(deviceStore.getDevice(deviceId));
  let effects = $derived(deviceStore.effects);
  let deviceModes = $derived(deviceStore.deviceModes);
  let updating = $state(false);
  let selectedEffectIndex = $state(0);
  let effectElements: HTMLButtonElement[] = [];
  let showMovieDialog = $state(false);
  let showRemoveDialog = $state(false);

  let deviceParams = $derived((device?.parameters || []).filter((p) => p.group === ParameterGroup.DEVICE));
  let effectParams = $derived((device?.parameters || []).filter((p) => p.group === ParameterGroup.EFFECT));

  // Check for active movie task on mount / device change
  $effect(() => {
    checkActiveMovieTask(deviceId);
  });

  async function checkActiveMovieTask(devId: string) {
    try {
      const result = await backendClient.getMovieStatus({
        query: { device_id: devId },
      });
      if (result.status === 200 && result.body.active) {
        showMovieDialog = true;
      }
    } catch {
      // Ignore — device may not exist yet
    }
  }

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
    if (device && device.effect && effects.length > 0) {
      const idx = effects.findIndex((e) => e.id === device.effect!.id);
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
    if (device.effect?.id === effect.id) return;

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
    if (!device || updating || !device.effect) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.sendMovie({
          body: {
            device_id: deviceId,
            effect_id: device.effect!.id,
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
    // Refresh device state after movie task finishes
    deviceStore.fetchDevice(deviceId);
  }

  async function handleRemoveDialogClose(removed: boolean) {
    showRemoveDialog = false;
    if (removed) {
      await deviceStore.fetchAllDevices();
      goto('/devices');
    }
  }

  async function cloneEffect() {
    if (!device || updating || selectedEffectIndex < 0 || selectedEffectIndex >= effects.length) return;
    const sourceEffect = effects[selectedEffectIndex];

    updating = true;
    try {
      const response = await backendClient.cloneEffect({
        body: { effect_id: sourceEffect.id },
      });
      if (response.status === 200) {
        const newEffectId = response.body.id;
        // Refresh effects list
        await deviceStore.fetchAllDevices();
        // Select and activate the cloned effect
        const newIndex = effects.findIndex((e) => e.id === newEffectId);
        if (newIndex >= 0) {
          await selectEffect(newIndex);
        }
      }
    } catch (e) {
      console.error('Failed to clone effect:', e);
    }
    updating = false;
  }

  async function deleteSelectedEffect() {
    if (!device || updating || selectedEffectIndex < 0 || selectedEffectIndex >= effects.length) return;
    const targetEffect = effects[selectedEffectIndex];
    if (!targetEffect.canDelete) return;

    updating = true;
    try {
      const response = await backendClient.deleteEffect({
        body: { effect_id: targetEffect.id },
      });
      if (response.status === 200) {
        // Determine next effect index after deletion
        const nextIndex = Math.min(selectedEffectIndex, effects.length - 2);
        await deviceStore.fetchAllDevices();
        if (effects.length > 0 && nextIndex >= 0) {
          await selectEffect(nextIndex);
        }
      }
    } catch (e) {
      console.error('Failed to delete effect:', e);
    }
    updating = false;
  }

  let selectedEffectCanDelete = $derived(
    selectedEffectIndex >= 0 && selectedEffectIndex < effects.length && effects[selectedEffectIndex]?.canDelete
  );

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

        {#if deviceParams.length}
          <EffectParameters deviceId={device.id} parameters={deviceParams} bind:updating />
        {/if}

        <button onclick={sendMovie} disabled={updating || !device.effect}> Send Movie </button>
        <button class="remove-device-button" onclick={() => (showRemoveDialog = true)} disabled={updating}>
          Remove Device
        </button>
      </div>

      <div class="effect-info-section">
        <h3>Effect Info</h3>
        <div class="effect-actions">
          <button class="clone-button" onclick={cloneEffect} disabled={updating || effects.length === 0}>
            Clone
          </button>
          <button class="delete-button" onclick={deleteSelectedEffect} disabled={updating || !selectedEffectCanDelete}>
            Delete
          </button>
        </div>
        <div class="info-list">
          <div class="info-item">
            <strong>ID:</strong>
            <span>{device.effect?.id ?? 'None'}</span>
          </div>
          <div class="info-item">
            <strong>Name:</strong>
            <span>{device.effect?.name ?? '—'}</span>
          </div>
          <div class="info-item">
            <strong>Type:</strong>
            <span>{device.effect?.type ?? '—'}</span>
          </div>
          <div class="info-item">
            <strong>Point Type:</strong>
            <span>{device.effect?.pointType ?? '—'}</span>
          </div>
          <div class="info-item">
            <strong>Animation Type:</strong>
            <span>{device.effect?.animationMode ?? '—'}</span>
          </div>
          {#if device.effect?.loop_duration_seconds != null}
            <div class="info-item">
              <strong>Loop Duration:</strong>
              <span>{device.effect.loop_duration_seconds.toFixed(2)}s</span>
            </div>
          {/if}
        </div>

        {#if effectParams.length}
          <EffectParameters deviceId={device.id} parameters={effectParams} bind:updating />
        {/if}
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
              class:active={device.effect?.id === effect.id}
              onclick={() => selectEffect(index)}
              onkeydown={handleKeyDown}
              tabindex={index === selectedEffectIndex ? 0 : -1}
            >
              <span class="effect-name">{effect.name}</span>
              <span class="active-badge" class:visible={device.effect?.id === effect.id}>Active</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="buffer-section">
        <DeviceBufferViewer deviceId={device.id} disableLive={showMovieDialog} />
      </div>
    </div>

    {#if showMovieDialog}
      <SendMovieDialog {deviceId} onclose={closeMovieDialog} />
    {/if}

    {#if showRemoveDialog}
      <RemoveDeviceDialog
        {deviceId}
        deviceAlias={device.alias}
        deviceIp={device.ip}
        onclose={handleRemoveDialogClose}
      />
    {/if}
  {:else}
    <p class="error">Device not found</p>
    <a href="/devices" class="back-button">← Back to Devices</a>
  {/if}
</div>

<style>
  .device-detail {
    padding: 1rem 2rem;
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

  h3 {
    color: #ff3e00;
    font-size: 1.4rem;
    margin: 0 0 1rem 0;
  }

  .device-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .device-info-section,
  .effect-info-section,
  .effects-section,
  .buffer-section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 0;
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

  .effect-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .clone-button,
  .delete-button {
    flex: 1;
  }

  .delete-button {
    background: #d32f2f;
  }

  .delete-button:hover:not(:disabled) {
    background: #b71c1c;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
  }

  .remove-device-button {
    background: #d32f2f;
    margin-top: 0.5rem;
  }

  .remove-device-button:hover:not(:disabled) {
    background: #b71c1c;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
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

  /* Small screens - single column */
  @media (max-width: 600px) {
    .device-content {
      grid-template-columns: 1fr;
    }
  }
</style>
