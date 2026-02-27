<script lang="ts">
  import { backendClient } from '../FrontendApiClient';

  interface Props {
    /** Called when the dialog should be closed (after success or cancel) */
    onclose: (added: boolean) => void;
  }

  let { onclose }: Props = $props();

  let ip = $state('192.168.0.');
  let submitting = $state(false);
  let resultMessage = $state('');
  let resultSuccess = $state(false);
  let done = $state(false);

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
    } catch (error) {
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
    <p class="description">Enter the IP address of your Twinkly device.</p>

    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="text"
      class="ip-input"
      bind:value={ip}
      onkeydown={handleKeydown}
      disabled={submitting || done}
      autofocus
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
          {submitting ? 'Connecting...' : 'Add'}
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
    max-width: 460px;
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
    margin: 0 0 0.5rem 0;
    color: #ff3e00;
    font-size: 1.3rem;
  }

  .description {
    color: #666;
    font-size: 0.95rem;
    margin: 0 0 1.25rem 0;
  }

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
