<script lang="ts">
  import { backendClient, type HelloResponse, type GetInfoResponse } from '../../FrontendApiClient';
  import { handleApiCall } from '../../utils/ApiHelper';

  let message = $state('');
  let info = $state<GetInfoResponse | null>(null);
  let loading = $state(false);
  let error = $state('');

  async function fetchHello() {
    loading = true;
    error = '';
    try {
      const result = await handleApiCall<HelloResponse>(
        () => backendClient.hello(),
        'Failed to connect to backend. Make sure the backend server is running on port 3001.'
      );
      message = result.message;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function fetchInfo() {
    loading = true;
    error = '';
    try {
      info = await handleApiCall<GetInfoResponse>(() => backendClient.getInfo(), 'Failed to get info from the server.');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchHello();
    fetchInfo();
  });
</script>

<div class="debug-page">
  <h2>Debug Information</h2>

  <div class="card">
    <h3>Hello World Test</h3>
    {#if loading && !message}
      <p class="loading">Loading...</p>
    {:else if error && !message}
      <p class="error">{error}</p>
    {:else if message}
      <p class="success">{message}</p>
    {/if}
    <button onclick={fetchHello} disabled={loading}>Refresh Hello</button>
  </div>

  <div class="card">
    <h3>Twinkly devices</h3>
    {#if loading && !info}
      <p class="loading">Loading...</p>
    {:else if error && !info}
      <p class="error">{error}</p>
    {:else if info?.devices?.length}
      <ul class="device-list">
        {#each info.devices as device}
          <li>
            <a class="device-link" href={`/debug/${device.id}?alias=${encodeURIComponent(device.alias)}`}
              >{device.alias}</a
            >
          </li>
        {/each}
      </ul>
    {:else}
      <p class="success">No devices discovered.</p>
    {/if}
    <button onclick={fetchInfo} disabled={loading}>Refresh</button>
  </div>

  <div class="card">
    <h3>Effect library</h3>
    <a class="device-link" href="/debug/effects">View Effects &rarr;</a>
  </div>
</div>

<style>
  .debug-page {
    max-width: 800px;
  }

  h2 {
    color: var(--color-text-heading);
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  h3 {
    color: var(--color-text-heading);
    margin-top: 0;
    font-size: 1.3rem;
  }

  .card {
    background: var(--color-bg-card);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: var(--shadow-card);
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

  .loading {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .error {
    color: var(--color-danger-text);
    background: var(--color-danger-bg);
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .success {
    color: var(--color-success-dark);
    background: var(--color-success-bg);
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
    font-size: 1.2rem;
    font-weight: 500;
  }

  .device-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .device-link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 600;
  }

  .device-link:hover {
    text-decoration: underline;
  }
</style>
