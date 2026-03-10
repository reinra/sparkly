<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { backendClient, type DeviceDebugResponse } from '../../../FrontendApiClient';
  import { handleApiCall } from '../../../utils/ApiHelper';

  let sections = $state<DeviceDebugResponse['sections']>([]);
  let loading = $state(false);
  let error = $state('');
  let deviceId = $state('');
  let deviceLabel = $state('');

  async function fetchDeviceDebug(id: string) {
    if (!id) {
      error = 'Missing device id.';
      return;
    }

    loading = true;
    error = '';
    try {
      const data = await handleApiCall<DeviceDebugResponse>(
        () => backendClient.debugDevice({ query: { device_id: id } }),
        'Failed to load device debug info.'
      );
      sections = data.sections;
    } catch (e) {
      error = (e as Error).message;
      sections = [];
    } finally {
      loading = false;
    }
  }

  function refreshDebugInfo() {
    if (deviceId) {
      fetchDeviceDebug(deviceId);
    }
  }

  function goBack() {
    goto('/debug');
  }

  $effect(() => {
    const nextId = $page.params.deviceId;
    if (!nextId) {
      error = 'Device id missing in route.';
      return;
    }

    if (nextId !== deviceId) {
      deviceId = nextId;
      const alias = $page.url.searchParams.get('alias');
      deviceLabel = alias ?? nextId;
      fetchDeviceDebug(nextId);
    }
  });
</script>

<div class="device-debug-page">
  <button class="back-button" type="button" onclick={goBack}>Back to Debug Overview</button>
  <h2>Debug: {deviceLabel}</h2>
  <p class="device-meta">Device ID: {deviceId}</p>

  {#if loading}
    <p class="loading">Loading device debug info...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if sections.length}
    <div class="debug-sections">
      {#each sections as section (section.title)}
        <section class="debug-section">
          <h3>{section.title}</h3>
          <pre>{section.content}</pre>
        </section>
      {/each}
    </div>
  {:else}
    <p class="empty-state">No debug data returned for this device.</p>
  {/if}

  <div class="actions">
    <button type="button" onclick={refreshDebugInfo} disabled={loading}>Refresh</button>
  </div>
</div>

<style>
  .device-debug-page {
    max-width: 900px;
  }

  h2 {
    color: var(--color-text-heading);
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .device-meta {
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
  }

  .back-button {
    background: transparent;
    color: var(--color-accent);
    border: none;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .back-button:hover {
    text-decoration: underline;
  }

  .loading,
  .empty-state {
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

  .debug-sections {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .debug-section {
    background: var(--color-bg-card);
    border-radius: 8px;
    padding: 1.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
  }

  .debug-section h3 {
    margin-top: 0;
    margin-bottom: 0.75rem;
    color: var(--color-text-heading);
  }

  pre {
    background: var(--color-bg-inset);
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9rem;
    margin: 0;
  }

  .actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.5rem;
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
</style>
