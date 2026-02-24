<script lang="ts">
  import { backendClient, type GetInfoResponse } from '../../../frontendApiClient';
  import { handleApiCall } from '../../../utils/apiHelper';

  let info = $state<GetInfoResponse | null>(null);
  let loading = $state(false);
  let error = $state('');

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
    fetchInfo();
  });
</script>

<div class="effects-page">
  <a class="back-link" href="/debug">&larr; Back to Debug</a>
  <h2>Effect Library</h2>

  <div class="card">
    {#if loading && !info}
      <p class="loading">Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if info?.effects?.length}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {#each info.effects as effect}
            <tr>
              <td>{effect.id}</td>
              <td>{effect.name}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="success">No effects found.</p>
    {/if}
    <button onclick={fetchInfo} disabled={loading}>Refresh</button>
  </div>
</div>

<style>
  .effects-page {
    max-width: 800px;
  }

  .back-link {
    color: #ff3e00;
    text-decoration: none;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  h2 {
    color: #333;
    font-size: 2rem;
    margin-bottom: 2rem;
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
