<script lang="ts">
  import { backendClient } from '../../../frontendApiClient';
  import type { DebugEffectsResponse, DebugEffectEntry } from '@twinkly-ts/common';
  import { handleApiCall } from '../../../utils/apiHelper';

  type SortKey = 'id' | 'name' | 'pointType' | 'animationMode' | 'isStateful' | 'hasCycleReset' | 'duration' | 'parametersCount';
  type SortDir = 'asc' | 'desc';

  let data = $state<DebugEffectsResponse | null>(null);
  let loading = $state(false);
  let error = $state('');
  let sortKey = $state<SortKey>('name');
  let sortDir = $state<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  let sortedEffects = $derived.by(() => {
    if (!data?.effects) return [];
    return [...data.effects].sort((a, b) => {
      const rawA = a[sortKey];
      const rawB = b[sortKey];
      let cmp: number;
      if (typeof rawA === 'number' || typeof rawB === 'number') {
        cmp = ((rawA as number) ?? -1) - ((rawB as number) ?? -1);
      } else {
        cmp = String(rawA).localeCompare(String(rawB));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  async function fetchEffects() {
    loading = true;
    error = '';
    try {
      data = await handleApiCall<DebugEffectsResponse>(() => backendClient.debugEffects(), 'Failed to load effects.');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchEffects();
  });
</script>

<div class="effects-page">
  <a class="back-link" href="/debug">&larr; Back to Debug</a>
  <h2>Effect Library</h2>

  <div class="card">
    {#if loading && !data}
      <p class="loading">Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if data?.effects?.length}
      <table>
        <thead>
          <tr>
            <th class="sortable" onclick={() => toggleSort('id')}>ID{sortIndicator('id')}</th>
            <th class="sortable" onclick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
            <th class="sortable" onclick={() => toggleSort('pointType')}>Point Type{sortIndicator('pointType')}</th>
            <th class="sortable" onclick={() => toggleSort('animationMode')}
              >Animation Mode{sortIndicator('animationMode')}</th
            >
            <th class="sortable" onclick={() => toggleSort('isStateful')}>State{sortIndicator('isStateful')}</th>
            <th class="sortable" onclick={() => toggleSort('hasCycleReset')}>Cycle Reset{sortIndicator('hasCycleReset')}</th>
            <th class="sortable" onclick={() => toggleSort('duration')}>Duration{sortIndicator('duration')}</th>
            <th class="sortable" onclick={() => toggleSort('parametersCount')}
              >Params{sortIndicator('parametersCount')}</th
            >
          </tr>
        </thead>
        <tbody>
          {#each sortedEffects as effect}
            <tr>
              <td>{effect.id}</td>
              <td>{effect.name}</td>
              <td>{effect.pointType}</td>
              <td>{effect.animationMode}</td>
              <td>{effect.isStateful ? 'Stateful' : 'Stateless'}</td>
              <td>{effect.hasCycleReset ? 'Yes' : '—'}</td>
              <td>{effect.duration != null ? `${effect.duration}s` : '—'}</td>
              <td>{effect.parametersCount}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="success">No effects found.</p>
    {/if}
    <button onclick={fetchEffects} disabled={loading}>Refresh</button>
  </div>
</div>

<style>
  .effects-page {
    max-width: 1100px;
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
    padding: 0.4rem 0.75rem;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #ddd;
    white-space: nowrap;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    background: #eee;
  }

  td {
    padding: 0.3rem 0.75rem;
    border-bottom: 1px solid #eee;
    white-space: nowrap;
  }

  tbody tr:hover {
    background: #f9f9f9;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
</style>
