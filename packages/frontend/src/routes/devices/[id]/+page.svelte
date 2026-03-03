<script lang="ts">
  import { backendClient } from '../../../FrontendApiClient';
  import { handleApiUpdate } from '../../../utils/ApiHelper';
  import DeviceBufferViewer from '../../../components/DeviceBufferViewer.svelte';
  import EffectParameters from '../../../components/EffectParameters.svelte';
  import SendMovieDialog from '../../../components/SendMovieDialog.svelte';
  import DeleteEffectDialog from '../../../components/DeleteEffectDialog.svelte';
  import RemoveDeviceDialog from '../../../components/RemoveDeviceDialog.svelte';
  import { deviceStore } from '../../../stores/DeviceStore.svelte';
  import { groupIndexedEffectsByCategory } from '../../../utils/EffectGrouping';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ParameterGroup } from '@sparkly/common';

  let deviceId = $derived(page.params.id);
  let device = $derived(deviceStore.getDevice(deviceId));
  let effects = $derived(deviceStore.effects);
  let deviceModes = $derived(deviceStore.deviceModes);
  let updating = $state(false);
  let reconnecting = $state(false);
  let selectedEffectIndex = $state(0);
  let effectElements: HTMLButtonElement[] = [];
  let effectSearchQuery = $state('');
  let selectedCategories = $state(new Set<string>());
  let allCategoriesSelected = $derived(
    selectedCategories.size === 0 || selectedCategories.size === deviceStore.effectCategories.length
  );
  let showMovieDialog = $state(false);
  let showRemoveDialog = $state(false);
  let showDeleteEffectDialog = $state(false);
  let editingEffectName = $state(false);
  let editEffectNameValue = $state('');
  let renameTextarea: HTMLTextAreaElement | undefined = $state();
  let isOnline = $derived(deviceStore.isOnline(device));
  let isOffline = $derived(deviceStore.isOffline(device));
  let isConnecting = $derived(deviceStore.isConnecting(device));

  let deviceParams = $derived((device?.parameters || []).filter((p) => p.group === ParameterGroup.DEVICE));
  let effectParams = $derived((device?.parameters || []).filter((p) => p.group === ParameterGroup.EFFECT));

  // Filtered effects preserving original indices for selection/operations
  let filteredEffects = $derived(
    effects
      .map((effect, index) => ({ effect, index }))
      .filter(({ effect }) => {
        // Category filter (empty set = all visible)
        if (selectedCategories.size > 0 && !allCategoriesSelected) {
          const cat = effect.category ?? 'animated';
          if (!selectedCategories.has(cat)) return false;
        }
        // Text search filter
        if (effectSearchQuery.trim()) {
          return effect.name.toLowerCase().includes(effectSearchQuery.trim().toLowerCase());
        }
        return true;
      })
  );

  let isFiltering = $derived(!allCategoriesSelected || effectSearchQuery.trim().length > 0);

  // Grouped view of filtered effects for rendering with category headers
  let groupedFilteredEffects = $derived(groupIndexedEffectsByCategory(filteredEffects, deviceStore.effectCategories));

  // Check for active movie task on mount / device change
  $effect(() => {
    if (device) {
      checkActiveMovieTask(deviceId);
    }
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
  let lastFetchedDeviceId: string | null = null;
  $effect(() => {
    if (!deviceStore.initialLoadDone && !deviceStore.loading) {
      deviceStore.fetchAllDevices();
    } else if (deviceId !== lastFetchedDeviceId) {
      // Only fetch when deviceId actually changes, not on every poll update
      lastFetchedDeviceId = deviceId;
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

    // Reset delete dialog when switching effects

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
        // Refresh device and effects list
        await deviceStore.fetchDevice(deviceId);
        // Select and activate the cloned effect
        const newIndex = effects.findIndex((e) => e.id === newEffectId);
        if (newIndex >= 0) {
          await selectEffect(newIndex);
          // Start editing the name of the cloned effect
          editEffectNameValue = response.body.name;
          editingEffectName = true;
        }
      }
    } catch (e) {
      console.error('Failed to clone effect:', e);
    }
    updating = false;
  }

  function deleteSelectedEffect() {
    if (!device || updating || selectedEffectIndex < 0 || selectedEffectIndex >= effects.length) return;
    const targetEffect = effects[selectedEffectIndex];
    if (!targetEffect.canDelete) return;
    showDeleteEffectDialog = true;
  }

  async function handleDeleteEffectDialogClose(deleted: boolean) {
    showDeleteEffectDialog = false;
    if (!deleted) return;
    if (!device || selectedEffectIndex < 0 || selectedEffectIndex >= effects.length) return;
    const targetEffect = effects[selectedEffectIndex];

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

  async function resetSelectedEffect() {
    if (!device || updating || selectedEffectIndex < 0 || selectedEffectIndex >= effects.length) return;
    const targetEffect = effects[selectedEffectIndex];

    updating = true;
    try {
      const response = await backendClient.resetEffect({
        body: { effect_id: targetEffect.id },
      });
      if (response.status === 200) {
        await deviceStore.fetchDevice(deviceId);
      }
    } catch (e) {
      console.error('Failed to reset effect:', e);
    }
    updating = false;
  }

  let selectedEffectCanDelete = $derived(
    selectedEffectIndex >= 0 && selectedEffectIndex < effects.length && effects[selectedEffectIndex]?.canDelete
  );

  function handleKeyDown(event: KeyboardEvent) {
    if (!filteredEffects.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();

      const currentFilteredIndex = filteredEffects.findIndex((f) => f.index === selectedEffectIndex);
      let newFilteredIndex: number;

      if (currentFilteredIndex < 0) {
        // Selected effect not in filtered list — start from beginning or end
        newFilteredIndex = event.key === 'ArrowDown' ? 0 : filteredEffects.length - 1;
      } else {
        newFilteredIndex =
          event.key === 'ArrowDown'
            ? Math.min(currentFilteredIndex + 1, filteredEffects.length - 1)
            : Math.max(currentFilteredIndex - 1, 0);
      }

      const newOriginalIndex = filteredEffects[newFilteredIndex].index;
      selectEffect(newOriginalIndex);
      // Keep focus on the newly selected effect button
      setTimeout(() => effectElements[newOriginalIndex]?.focus(), 0);
    }
  }

  function toggleCategory(key: string) {
    const next = new Set(selectedCategories);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    // If all are now selected, clear the set (= show all)
    if (next.size === deviceStore.effectCategories.length) {
      selectedCategories = new Set();
    } else {
      selectedCategories = next;
    }
  }

  function resetCategoryFilter() {
    selectedCategories = new Set();
  }

  function handleSearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      effectSearchQuery = '';
      selectedCategories = new Set();
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'ArrowDown' && filteredEffects.length > 0) {
      event.preventDefault();
      // Jump focus into the effects list
      const firstOriginalIndex = filteredEffects[0].index;
      effectElements[firstOriginalIndex]?.focus();
    }
  }

  function startEditEffectName() {
    if (!device?.effect || updating) return;
    editEffectNameValue = device.effect.name;
    editingEffectName = true;
  }

  $effect(() => {
    if (editingEffectName && renameTextarea) {
      renameTextarea.focus();
      renameTextarea.select();
    }
  });

  async function saveEffectName() {
    if (!device?.effect || updating) return;
    const trimmed = editEffectNameValue.trim();
    if (!trimmed || trimmed === device.effect.name) {
      editingEffectName = false;
      return;
    }
    updating = true;
    try {
      const result = await deviceStore.renameEffect(device.effect.id, trimmed);
      if (result) {
        await deviceStore.fetchDevice(deviceId);
      }
    } catch (e) {
      console.error('Failed to rename effect:', e);
    }
    editingEffectName = false;
    updating = false;
  }

  function cancelEditEffectName() {
    editingEffectName = false;
  }

  function handleRenameKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEffectName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditEffectName();
    }
  }

  async function reconnect() {
    if (reconnecting) return;
    reconnecting = true;
    await deviceStore.reconnectDevice(deviceId);
    reconnecting = false;
  }
</script>

<div class="device-detail">
  {#if deviceStore.loading}
    <p class="loading">Loading device...</p>
  {:else if deviceStore.error}
    <p class="error">{deviceStore.error}</p>
  {:else if device}
    {#if !isOnline}
      <div class="offline-detail-banner">
        <span class="status-dot offline"></span>
        <span
          >{isConnecting
            ? `Connecting to ${device.ip}...`
            : `Device unreachable at ${device.ip}. The backend will retry automatically every 30 seconds.`}</span
        >
        {#if !isConnecting}
          <button class="reconnect-button" onclick={reconnect} disabled={reconnecting}>
            {reconnecting ? 'Reconnecting...' : 'Reconnect Now'}
          </button>
        {/if}
      </div>
    {/if}
    <div class="device-content" class:content-offline={!isOnline}>
      <div class="device-info-section">
        <div class="section-header">
          <h3>Device Information</h3>
          <button class="remove-device-button" onclick={() => (showRemoveDialog = true)} disabled={updating}>
            Remove Device
          </button>
        </div>
        <div class="info-list">
          <div class="info-item">
            <strong>Status:</strong>
            <span
              class="status-badge"
              class:online={isOnline}
              class:offline={isOffline}
              class:connecting={isConnecting}
            >
              {isOnline ? 'Online' : isOffline ? 'Disconnected' : 'Connecting'}
            </span>
          </div>
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
              <select id="mode" value={device.mode} onchange={updateMode} disabled={updating || !isOnline}>
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

        <button onclick={sendMovie} disabled={updating || !device.effect || !isOnline}> Send Movie </button>
      </div>

      <div class="effect-info-section">
        <h3>Effect Info</h3>
        <div class="effect-actions">
          <button class="clone-button" onclick={cloneEffect} disabled={updating || effects.length === 0}>
            Clone
          </button>
          <button class="reset-button" onclick={resetSelectedEffect} disabled={updating || effects.length === 0}>
            Reset
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
          <div class="info-item info-item-name">
            <strong>Name:</strong>
            {#if editingEffectName}
              <textarea
                class="rename-input"
                bind:this={renameTextarea}
                bind:value={editEffectNameValue}
                onkeydown={handleRenameKeyDown}
                onblur={saveEffectName}
                maxlength="64"
                rows="2"
              ></textarea>
            {:else}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span class="effect-name-editable" ondblclick={startEditEffectName} title="Double-click to rename"
                >{device.effect?.name ?? '—'}</span
              >
              {#if device.effect}
                <button class="rename-button" onclick={startEditEffectName} disabled={updating} title="Rename effect"
                  >✏️</button
                >
              {/if}
            {/if}
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
        <div class="category-filters">
          {#each deviceStore.effectCategories as cat (cat.key)}
            <button
              class="category-pill"
              class:active={selectedCategories.size === 0 || selectedCategories.has(cat.key)}
              onclick={() => toggleCategory(cat.key)}
            >
              {cat.label}
            </button>
          {/each}
          {#if !allCategoriesSelected}
            <button class="category-pill reset" onclick={resetCategoryFilter} title="Show all categories">All</button>
          {/if}
        </div>
        <div class="effects-search">
          <input
            type="text"
            class="effects-search-input"
            placeholder="Filter effects…"
            bind:value={effectSearchQuery}
            onkeydown={handleSearchKeyDown}
          />
          {#if effectSearchQuery.trim()}
            <button class="search-clear-button" onclick={() => (effectSearchQuery = '')} title="Clear filter">✕</button>
          {/if}
          <span class="effects-count">{filteredEffects.length}{isFiltering ? ` / ${effects.length}` : ''}</span>
        </div>
        <p class="hint">↑↓ navigate effects | ←→ adjust params | Escape clears filter</p>
        <div class="effects-list">
          {#each groupedFilteredEffects as group}
            <div class="effect-category-header">{group.label}</div>
            {#each group.entries as { effect, index: originalIndex } (effect.id)}
              <button
                bind:this={effectElements[originalIndex]}
                class="effect-item"
                class:selected={originalIndex === selectedEffectIndex}
                class:active={device.effect?.id === effect.id}
                onclick={() => selectEffect(originalIndex)}
                onkeydown={handleKeyDown}
                tabindex={originalIndex === selectedEffectIndex ? 0 : -1}
              >
                <span class="effect-name">{effect.name}</span>
                <span class="active-badge" class:visible={device.effect?.id === effect.id}>Active</span>
              </button>
            {/each}
          {/each}
          {#if filteredEffects.length === 0 && isFiltering}
            <p class="no-results">
              {#if !allCategoriesSelected && !effectSearchQuery.trim()}
                No effects in the selected {selectedCategories.size === 1 ? 'category' : 'categories'}
              {:else if effectSearchQuery.trim()}
                No effects match "{effectSearchQuery.trim()}"
              {:else}
                No categories selected
              {/if}
            </p>
          {/if}
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

    {#if showDeleteEffectDialog && selectedEffectIndex >= 0 && selectedEffectIndex < effects.length}
      <DeleteEffectDialog effectName={effects[selectedEffectIndex].name} onclose={handleDeleteEffectDialogClose} />
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
  .reset-button,
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

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
  }

  .remove-device-button {
    background: #d32f2f;
    width: auto;
    font-size: 0.8rem;
    padding: 0.3rem 0.75rem;
    margin: 0;
  }

  .remove-device-button:hover:not(:disabled) {
    background: #b71c1c;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
  }

  .category-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .category-pill {
    padding: 0.15rem 0.55rem;
    font-size: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 999px;
    background: transparent;
    color: #888;
    cursor: pointer;
    transition: all 0.15s;
    line-height: 1.4;
    box-shadow: none;
    width: auto;
  }

  .category-pill:hover {
    border-color: #ff3e00;
    color: #ff3e00;
    background: transparent;
    transform: none;
    box-shadow: none;
  }

  .category-pill.active {
    background: #ff3e00;
    border-color: #ff3e00;
    color: white;
  }

  .category-pill.active:hover {
    background: #e63900;
    border-color: #e63900;
    transform: none;
    box-shadow: none;
  }

  .category-pill.reset {
    border-style: dashed;
    color: #999;
    width: auto;
  }

  .category-pill.reset:hover {
    color: #ff3e00;
    border-color: #ff3e00;
    background: transparent;
  }

  .effects-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    position: relative;
  }

  .effects-search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.95rem;
    color: #333;
    background: #f8f8f8;
    outline: none;
    transition: border-color 0.2s;
  }

  .effects-search-input:focus {
    border-color: #ff3e00;
    background: white;
  }

  .effects-search-input::placeholder {
    color: #aaa;
  }

  .search-clear-button {
    background: transparent;
    border: none;
    color: #999;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    width: auto;
    line-height: 1;
    box-shadow: none;
  }

  .search-clear-button:hover:not(:disabled) {
    color: #ff3e00;
    background: transparent;
    transform: none;
    box-shadow: none;
  }

  .effects-count {
    color: #999;
    font-size: 0.85rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .no-results {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 1rem;
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

  .effect-category-header {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    padding: 0.5rem 0.25rem 0.15rem;
    margin-top: 0.25rem;
  }

  .effect-category-header:first-child {
    margin-top: 0;
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

  .info-item-name {
    align-items: flex-start;
  }

  .effect-name-editable {
    cursor: default;
  }

  .rename-input {
    flex: 1;
    padding: 0.3rem 0.5rem;
    border: 1px solid #ff3e00;
    border-radius: 4px;
    font-size: 1rem;
    font-family: inherit;
    color: #333;
    outline: none;
    resize: vertical;
  }

  .rename-button {
    background: transparent;
    border: none;
    padding: 0.2rem 0.4rem;
    font-size: 0.9rem;
    cursor: pointer;
    width: auto;
    color: #666;
    box-shadow: none;
  }

  .rename-button:hover:not(:disabled) {
    background: transparent;
    transform: none;
    box-shadow: none;
    color: #ff3e00;
  }

  .rename-button:disabled {
    background: transparent;
    opacity: 0.3;
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

  .offline-detail-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ef9a9a;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #d32f2f;
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

  .reconnect-button {
    margin-left: auto;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1.2rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
    width: auto;
    flex-shrink: 0;
  }

  .reconnect-button:hover:not(:disabled) {
    background: #1565c0;
    transform: none;
    box-shadow: none;
  }

  .reconnect-button:disabled {
    background: #90caf9;
    cursor: not-allowed;
  }

  .status-badge {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .status-badge.online {
    color: #2e7d32;
  }

  .status-badge.offline,
  .status-badge.connecting {
    color: #d32f2f;
  }

  .content-offline {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
