<script lang="ts">
  import { backendClient } from '../FrontendApiClient';
  import type { DiscoveredDevice } from '@sparkly/common';

  interface Props {
    /** Called when the dialog should be closed (after success or cancel) */
    onclose: (added: boolean) => void;
  }

  let { onclose }: Props = $props();

  // ── Discovery state ──
  let scanning = $state(true);
  let scanError = $state('');
  let discoveredDevices = $state<DiscoveredDevice[]>([]);
  let addingIp = $state<string | null>(null);

  // ── Manual-add state ──
  let ip = $state('192.168.0.');
  let submitting = $state(false);
  let resultMessage = $state('');
  let resultSuccess = $state(false);
  let done = $state(false);

  // ── Start scanning on mount ──
  runDiscovery();

  async function runDiscovery() {
    scanning = true;
    scanError = '';
    discoveredDevices = [];

    try {
      const response = await backendClient.discoverDevices();
      if (response.status === 200) {
        discoveredDevices = response.body.devices;
      } else {
        scanError = 'Failed to scan network.';
      }
    } catch {
      scanError = 'Could not reach backend for discovery.';
    } finally {
      scanning = false;
    }
  }

  async function addDiscoveredDevice(device: DiscoveredDevice) {
    if (addingIp || submitting) return;

    addingIp = device.ip;
    resultMessage = '';

    try {
      const response = await backendClient.addDevice({
        body: { ip: device.ip },
      });

      if (response.status === 200) {
        const body = response.body;
        if (body.success) {
          resultSuccess = true;
          resultMessage = `Connected to "${body.deviceName}"!`;
          done = true;
        } else {
          resultSuccess = false;
          resultMessage = body.error;
        }
      } else {
        resultSuccess = false;
        const errorBody = response.body as { error: string };
        resultMessage = errorBody.error || 'Unexpected error from server.';
      }
    } catch {
      resultSuccess = false;
      resultMessage = 'Failed to connect to backend.';
    } finally {
      addingIp = null;
    }
  }

  async function handleSubmit() {
    if (!ip.trim() || submitting) return;

    submitting = true;
    resultMessage = '';

    try {
      const response = await backendClient.addDevice({
        body: { ip: ip.trim() },
      });

      if (response.status === 200) {
        const body = response.body;
        if (body.success) {
          resultSuccess = true;
          resultMessage = `Connected to "${body.deviceName}"!`;
          done = true;
        } else {
          resultSuccess = false;
          resultMessage = body.error;
        }
      } else {
        resultSuccess = false;
        const errorBody = response.body as { error: string };
        resultMessage = errorBody.error || 'Unexpected error from server.';
      }
    } catch {
      resultSuccess = false;
      resultMessage = 'Failed to connect to backend. Make sure the server is running.';
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !submitting && !done) {
      handleSubmit();
    } else if (event.key === 'Escape') {
      onclose(done && resultSuccess);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={() => onclose(done && resultSuccess)}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog" onclick={(e) => e.stopPropagation()}>
    <h3>Add Device</h3>

    <!-- ── Discovery section ── -->
    <div class="section-label">Devices on network</div>

    {#if scanning}
      <div class="status-row">
        <span class="status-icon spinning">&#9881;</span>
        <span class="status-label">Scanning network...</span>
      </div>
    {:else if scanError}
      <div class="result-message error">
        <span class="result-icon">&#10007;</span>
        {scanError}
      </div>
      <button class="rescan-button" onclick={runDiscovery} disabled={done}>Rescan</button>
    {:else if discoveredDevices.length === 0}
      <div class="empty-message">No devices found on the network.</div>
      <button class="rescan-button" onclick={runDiscovery} disabled={done}>Rescan</button>
    {:else}
      <div class="device-list">
        {#each discoveredDevices as device (device.ip)}
          <div class="device-row" class:already-added={device.alreadyAdded}>
            <div class="device-info">
              <span class="device-name">{device.deviceName}</span>
              <span class="device-details">
                <span class="device-ip">{device.ip}</span>
                {#if device.ledCount}
                  <span class="device-leds">{device.ledCount} LEDs</span>
                {/if}
              </span>
            </div>
            {#if device.alreadyAdded}
              <span class="badge-added">Added</span>
            {:else if addingIp === device.ip}
              <span class="status-icon spinning small">&#9881;</span>
            {:else}
              <button
                class="add-row-button"
                onclick={() => addDiscoveredDevice(device)}
                disabled={done || !!addingIp || submitting}
              >
                Add
              </button>
            {/if}
          </div>
        {/each}
      </div>
      <button class="rescan-button" onclick={runDiscovery} disabled={scanning || done}>Rescan</button>
    {/if}

    <!-- ── Divider ── -->
    <div class="divider">
      <span class="divider-text">or enter IP manually</span>
    </div>

    <!-- ── Manual IP input ── -->
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      class="ip-input"
      bind:value={ip}
      onkeydown={handleKeydown}
      disabled={submitting || done}
      placeholder="192.168.0.100"
    />

    {#if resultMessage}
      <div class="result-message" class:success={resultSuccess} class:error={!resultSuccess}>
        <span class="result-icon">
          {#if resultSuccess}&#10003;{:else}&#10007;{/if}
        </span>
        {resultMessage}
      </div>
    {/if}

    {#if submitting}
      <div class="status-row">
        <span class="status-icon spinning">&#9881;</span>
        <span class="status-label">Connecting...</span>
      </div>
    {/if}

    <div class="button-row">
      {#if done && resultSuccess}
        <button class="action-button" onclick={() => onclose(true)}>Close</button>
      {:else}
        <button class="cancel-button" onclick={() => onclose(false)} disabled={submitting}>Cancel</button>
        <button class="action-button" onclick={handleSubmit} disabled={submitting || !ip.trim() || done}>
          {submitting ? 'Connecting...' : 'Add manually'}
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .dialog {
    background: var(--color-bg-card);
    border-radius: 12px;
    padding: 2rem;
    min-width: 360px;
    max-width: 500px;
    width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--shadow-dialog);
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  h3 {
    margin: 0 0 0.75rem 0;
    color: var(--color-accent);
    font-size: 1.3rem;
  }

  /* ── Discovery section ── */

  .section-label {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .device-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border-lighter);
    border-radius: 8px;
    background: var(--color-bg-card-hover);
    transition: background 0.15s;
  }

  .device-row:not(.already-added):hover {
    background: var(--color-accent-bg-hover);
    border-color: var(--color-accent);
  }

  .device-row.already-added {
    opacity: 0.6;
  }

  .device-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .device-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .device-details {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .device-ip {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    font-family: monospace;
  }

  .device-leds {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0.1rem 0.4rem;
    background: var(--color-badge-leds-bg);
    border-radius: 4px;
  }

  .badge-added {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-success);
    padding: 0.2rem 0.6rem;
    border: 1px solid var(--color-success-border);
    border-radius: 12px;
    background: var(--color-success-bg);
    white-space: nowrap;
  }

  .add-row-button {
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.3rem 1rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .add-row-button:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 6px var(--color-accent-focus);
  }

  .add-row-button:disabled {
    background: var(--color-btn-disabled);
    cursor: not-allowed;
  }

  .rescan-button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.35rem 1rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 0.25rem;
  }

  .rescan-button:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .rescan-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .empty-message {
    color: var(--color-text-dim);
    font-size: 0.9rem;
    padding: 0.75rem 0;
  }

  /* ── Divider ── */

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1.25rem 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border-light);
  }

  .divider-text {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  /* ── Form elements ── */

  .ip-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
    border: 2px solid var(--color-border-input);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    font-family: monospace;
    background: var(--color-bg-input);
    color: var(--color-text-primary);
  }

  .ip-input:focus {
    border-color: var(--color-accent);
  }

  .ip-input:disabled {
    background: var(--color-bg-inset);
    color: var(--color-text-dim);
  }

  .result-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.95rem;
    margin-top: 1rem;
  }

  .result-message.success {
    background: var(--color-success-bg);
    color: var(--color-success-dark);
    border: 1px solid var(--color-success-border);
  }

  .result-message.error {
    background: var(--color-danger-bg);
    color: var(--color-danger-text);
    border: 1px solid var(--color-danger-border);
  }

  .result-icon {
    font-size: 1.2rem;
    font-weight: bold;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    font-size: 1.05rem;
  }

  .status-icon {
    font-size: 1.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
  }

  .status-icon.spinning {
    animation: spin 1.5s linear infinite;
    color: var(--color-accent);
  }

  .status-icon.spinning.small {
    font-size: 1rem;
    width: 1.5rem;
    height: 1.5rem;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .status-label {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-button {
    flex: 1;
    background: var(--color-btn-neutral);
    color: var(--color-btn-neutral-text);
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover:not(:disabled) {
    background: var(--color-btn-neutral-hover);
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button {
    flex: 1;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--color-accent-focus);
  }

  .action-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .action-button:disabled {
    background: var(--color-btn-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
