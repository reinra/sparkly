<script lang="ts">
  import DeviceCard from '../../components/DeviceCard.svelte';
  import { deviceStore } from '../../stores/DeviceStore.svelte';

  $effect(() => {
    // Fetch devices on mount if not already loaded
    if (deviceStore.devices.length === 0 && !deviceStore.loading) {
      deviceStore.fetchAllDevices();
    }
  });
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

  <button onclick={() => deviceStore.fetchAllDevices()} disabled={deviceStore.loading}> Refresh Devices </button>
</div>

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
