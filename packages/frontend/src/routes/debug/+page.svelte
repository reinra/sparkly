<script lang="ts">
  import {
    backendClient,
    type HelloResponse,
    type GetInfoResponse,
  } from '../../frontendApiClient';
  import { handleApiCall } from '../../utils/apiHelper';

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
      info = await handleApiCall<GetInfoResponse>(
        () => backendClient.getInfo(),
        'Failed to get info. Make sure config.toml is properly configured.'
      );
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
            <a
              class="device-link"
              href={`/debug/${device.id}?alias=${encodeURIComponent(device.alias)}`}
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
    {#if loading && !message}
      <p class="loading">Loading...</p>
    {:else if error && !message}
      <p class="error">{error}</p>
    {:else if message}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {#each info?.effects as effect}
            <tr>
              <td>{effect.id}</td>
              <td>{effect.name}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <ul></ul>
    <button onclick={fetchInfo} disabled={loading}>Refresh</button>
  </div>

</div>

<style>
  .debug-page {
    max-width: 800px;
  }

  h2 {
    color: #333;
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  h3 {
    color: #333;
    margin-top: 0;
    font-size: 1.3rem;
  }

  .card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .success {
    color: #2e7d32;
    background: #e8f5e9;
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
    color: #ff3e00;
    text-decoration: none;
    font-weight: 600;
  }

  .device-link:hover {
    text-decoration: underline;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  thead {
    background: #f5f5f5;
  }

  th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #ddd;
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
  }

  tbody tr:hover {
    background: #f9f9f9;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
</style>
