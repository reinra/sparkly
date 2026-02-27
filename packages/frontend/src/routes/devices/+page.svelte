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
    color: #333;
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
    background: #ff3e00;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #e63900;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .add-button {
    background: #0f9d58;
  }

  .add-button:hover {
    background: #0a7d45;
  }

  .loading {
    color: #666;
    font-style: italic;
    padding: 2rem;
    text-align: center;
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .no-devices {
    color: #666;
    padding: 2rem;
    text-align: center;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>
