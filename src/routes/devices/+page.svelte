<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../../frontendApiClient';
  import DeviceCard from '../../components/DeviceCard.svelte';

  let info = $state<GetInfoResponse | null>(null);
  let loading = $state(false);
  let error = $state('');

  async function fetchDevices() {
    try {
      loading = true;
      error = '';
      const response = await backendClient.getInfo();
      if (response.status === 200) {
        info = response.body;
      } else if (response.status === 500) {
        error = response.body.error;
      } else {
        error = 'Unexpected response from server';
      }
    } catch (e) {
      error = 'Failed to get info. Make sure config.toml is properly configured.';
      console.error('Error:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchDevices();
  });
</script>

<div class="devices-page">
  <h2>Twinkly Devices</h2>

  {#if loading}
    <p class="loading">Loading devices...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if info?.devices && info.devices.length > 0}
    <div class="devices-grid">
      {#each info.devices as device}
        <DeviceCard {device} />
      {/each}
    </div>
  {:else}
    <p class="no-devices">No devices configured</p>
  {/if}

  <button onclick={fetchDevices} disabled={loading}> Refresh Devices </button>
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
