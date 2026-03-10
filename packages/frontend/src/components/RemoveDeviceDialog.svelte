<script lang="ts">
  import { backendClient } from '../FrontendApiClient';

  interface Props {
    deviceId: string;
    deviceAlias: string;
    deviceIp: string;
    /** Called when the dialog should be closed. `removed` is true if device was successfully removed. */
    onclose: (removed: boolean) => void;
  }

  let { deviceId, deviceAlias, deviceIp, onclose }: Props = $props();
  let submitting = $state(false);
  let errorMessage = $state('');

  async function handleRemove() {
    if (submitting) return;

    submitting = true;
    errorMessage = '';

    try {
      const response = await backendClient.removeDevice({
        body: { device_id: deviceId },
      });

      if (response.status === 200) {
        if (response.body.success) {
          onclose(true);
        } else {
          errorMessage = response.body.error;
        }
      } else {
        const errorBody = response.body as { error: string };
        errorMessage = errorBody.error || 'Unexpected error from server.';
      }
    } catch {
      errorMessage = 'Failed to connect to backend. Make sure the server is running.';
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose(false);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={() => onclose(false)}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog" onclick={(e) => e.stopPropagation()}>
    <h3>Remove Device</h3>
    <p class="description">
      Are you sure you want to remove <strong>{deviceAlias}</strong> ({deviceIp})?
    </p>
    <p class="warning">This will stop any running effects and remove the device from the configuration.</p>

    {#if errorMessage}
      <div class="error-message">
        <span class="error-icon">&#10007;</span>
        {errorMessage}
      </div>
    {/if}

    {#if submitting}
      <div class="status-row">
        <span class="status-icon spinning">&#9881;</span>
        <span class="status-label">Removing...</span>
      </div>
    {/if}

    <div class="button-row">
      <button class="cancel-button" onclick={() => onclose(false)} disabled={submitting}>Cancel</button>
      <button class="remove-button" onclick={handleRemove} disabled={submitting}>
        {submitting ? 'Removing...' : 'Remove'}
      </button>
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
    max-width: 460px;
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
    margin: 0 0 0.5rem 0;
    color: var(--color-danger);
    font-size: 1.3rem;
  }

  .description {
    color: var(--color-text-primary);
    font-size: 0.95rem;
    margin: 0 0 0.5rem 0;
  }

  .warning {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin: 0 0 1.25rem 0;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.95rem;
    margin-top: 1rem;
    background: var(--color-danger-bg);
    color: var(--color-danger-text);
    border: 1px solid var(--color-danger-border);
  }

  .error-icon {
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
    color: var(--color-danger);
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

  .remove-button {
    flex: 1;
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-button:hover:not(:disabled) {
    background: var(--color-danger-dark);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
  }

  .remove-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .remove-button:disabled {
    background: var(--color-btn-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
