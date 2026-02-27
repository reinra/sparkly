<script lang="ts">
  import { backendClient } from '../FrontendApiClient';
  import type { DiscoveredDevice } from '@twinkly-ts/common';

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
    background: rgba(0, 0, 0, 0.5);
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
    background: white;
    border-radius: 12px;
    padding: 2rem;
    min-width: 360px;
    max-width: 500px;
    width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
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
    color: #ff3e00;
    font-size: 1.3rem;
  }

  /* ── Discovery section ── */

  .section-label {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
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
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    background: #fafafa;
    transition: background 0.15s;
  }

  .device-row:not(.already-added):hover {
    background: #fff3ef;
    border-color: #ffc9b8;
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
    color: #333;
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
    color: #999;
    font-family: monospace;
  }

  .device-leds {
    font-size: 0.75rem;
    color: #888;
    padding: 0.1rem 0.4rem;
    background: #f0f0f0;
    border-radius: 4px;
  }

  .badge-added {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4caf50;
    padding: 0.2rem 0.6rem;
    border: 1px solid #a5d6a7;
    border-radius: 12px;
    background: #e8f5e9;
    white-space: nowrap;
  }

  .add-row-button {
    background: #ff3e00;
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
    background: #e63900;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(255, 62, 0, 0.25);
  }

  .add-row-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .rescan-button {
    background: none;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.35rem 1rem;
    font-size: 0.85rem;
    color: #666;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 0.25rem;
  }

  .rescan-button:hover:not(:disabled) {
    border-color: #ff3e00;
    color: #ff3e00;
  }

  .rescan-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .empty-message {
    color: #999;
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
    background: #e0e0e0;
  }

  .divider-text {
    font-size: 0.8rem;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  /* ── Form elements ── */

  .ip-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    font-family: monospace;
  }

  .ip-input:focus {
    border-color: #ff3e00;
  }

  .ip-input:disabled {
    background: #f5f5f5;
    color: #999;
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
    background: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #a5d6a7;
  }

  .result-message.error {
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ef9a9a;
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
    color: #ff3e00;
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
    color: #333;
    font-weight: 500;
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-button {
    flex: 1;
    background: #e0e0e0;
    color: #333;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover:not(:disabled) {
    background: #d0d0d0;
  }

  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button {
    flex: 1;
    background: #ff3e00;
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
    background: #e63900;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 62, 0, 0.3);
  }

  .action-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .action-button:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
