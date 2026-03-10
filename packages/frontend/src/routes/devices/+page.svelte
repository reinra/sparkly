<script lang="ts">
  import DeviceCard from '../../components/DeviceCard.svelte';
  import AddDeviceDialog from '../../components/AddDeviceDialog.svelte';
  import { deviceStore } from '../../stores/DeviceStore.svelte';

  let showAddDialog = $state(false);

  $effect(() => {
    // Fetch devices on mount if not already loaded
    if (!deviceStore.initialLoadDone && !deviceStore.loading) {
      deviceStore.fetchAllDevices();
    }
  });

  function handleAddDialogClose(added: boolean) {
    showAddDialog = false;
    if (added) {
      deviceStore.fetchAllDevices();
    }
  }
</script>

<div class="devices-page">
  <h2>Twinkly Devices</h2>

  {#if deviceStore.loading}
    <p class="loading">Loading devices...</p>
  {:else if deviceStore.error}
    <p class="error">{deviceStore.error}</p>
  {:else if deviceStore.devices.length > 0}
    <div class="devices-grid">
      {#each deviceStore.devices as device (device.id)}
        <DeviceCard {device} effects={deviceStore.effects} />
      {/each}
    </div>
  {:else}
    <p class="no-devices">No devices configured</p>
  {/if}

  <div class="actions">
    <button onclick={() => deviceStore.fetchAllDevices()} disabled={deviceStore.loading}> Refresh Devices </button>
    <button class="add-button" onclick={() => (showAddDialog = true)}> + Add Device </button>
  </div>
</div>

{#if showAddDialog}
  <AddDeviceDialog onclose={handleAddDialogClose} />
{/if}

<style>
  .devices-page {
    max-width: 1200px;
  }

  h2 {
    color: var(--color-text-heading);
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  .devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  button {
    background: var(--color-accent);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  button:disabled {
    background: var(--color-btn-disabled);
    cursor: not-allowed;
  }

  .add-button {
    background: var(--color-secondary);
  }

  .add-button:hover {
    background: var(--color-secondary-hover);
  }

  .loading {
    color: var(--color-text-secondary);
    font-style: italic;
    padding: 2rem;
    text-align: center;
  }

  .error {
    color: var(--color-danger-text);
    background: var(--color-danger-bg);
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .no-devices {
    color: var(--color-text-secondary);
    padding: 2rem;
    text-align: center;
    background: var(--color-bg-card);
    border-radius: 8px;
    box-shadow: var(--shadow-card);
  }
</style>
