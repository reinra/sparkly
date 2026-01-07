<script lang="ts">
  import { backendClient, type HelloResponse, type StatusResponse, type GetInfoResponse } from '../frontendApiClient';

  let message = $state('');
  let info = $state<GetInfoResponse | null>(null);
  let status = $state<StatusResponse | null>(null);
  let loading = $state(false);
  let error = $state('');

  async function fetchHello() {
    try {
      loading = true;
      error = '';
      const response = await backendClient.hello();

      if (response.status === 200) {
        message = response.body.message;
      } else {
        error = 'Unexpected response from server';
      }
    } catch (e) {
      error = 'Failed to connect to backend. Make sure the backend server is running on port 3001.';
      console.error('Error:', e);
    } finally {
      loading = false;
    }
  }

  async function fetchInfo() {
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

  async function fetchStatus() {
    try {
      loading = true;
      error = '';
      const response = await backendClient.status();

      if (response.status === 200) {
        status = response.body;
      } else if (response.status === 500 || response.status === 503) {
        error = response.body.error;
      } else {
        error = 'Unexpected response from server';
      }
    } catch (e) {
      error = 'Failed to get device status. Make sure config.toml is properly configured.';
      console.error('Error:', e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchHello();
    fetchInfo();
  });
</script>

<main>
  <h1>Twinkly LED Controller</h1>

  <div class="card">
    <h2>Hello World Test</h2>
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
    <h2>Twinkly devices</h2>
    {#if loading && !message}
      <p class="loading">Loading...</p>
    {:else if error && !message}
      <p class="error">{error}</p>
    {:else if message}
      <p class="success">
        {#each info?.devices as device}
          <li><strong>{device.alias}</strong></li>
        {/each}
      </p>
    {/if}
    <ul></ul>
    <button onclick={fetchInfo} disabled={loading}>Refresh</button>
  </div>

  <div class="card">
    <h2>Effect library</h2>
    {#if loading && !message}
      <p class="loading">Loading...</p>
    {:else if error && !message}
      <p class="error">{error}</p>
    {:else if message}
      <p class="success">
        {#each info?.effects as effect}
          <li><strong>{effect.name}</strong></li>
        {/each}
      </p>
    {/if}
    <ul></ul>
    <button onclick={fetchInfo} disabled={loading}>Refresh</button>
  </div>

  <div class="card">
    <h2>Device Status</h2>
    {#if status}
      <div class="status">
        <h3>Device Info</h3>
        <pre>{JSON.stringify(status.device, null, 2)}</pre>
        <h3>Summary</h3>
        <pre>{JSON.stringify(status.summary, null, 2)}</pre>
        <h3>LED Configuration</h3>
        <pre>{JSON.stringify(status.ledConfig, null, 2)}</pre>
      </div>
    {:else if error && !status}
      <p class="error">{error}</p>
    {/if}
    <button onclick={fetchStatus} disabled={loading}>Get Device Status</button>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  h1 {
    color: #ff3e00;
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 2rem;
  }

  h2 {
    color: #333;
    margin-top: 0;
  }

  h3 {
    color: #666;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
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

  .status pre {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.875rem;
  }
</style>
