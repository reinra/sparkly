<script lang="ts">
  interface Props {
    effectName: string;
    /** Called when the dialog should be closed. `deleted` is true if the user confirmed deletion. */
    onclose: (deleted: boolean) => void;
  }

  let { effectName, onclose }: Props = $props();

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
    <h3>Delete Effect</h3>
    <p class="description">
      Are you sure you want to delete <strong>{effectName}</strong>?
    </p>
    <p class="warning">This action cannot be undone.</p>

    <div class="button-row">
      <button class="cancel-button" onclick={() => onclose(false)}>Cancel</button>
      <button class="delete-button" onclick={() => onclose(true)}>Delete</button>
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
    color: #d32f2f;
    font-size: 1.3rem;
  }

  .description {
    color: #333;
    font-size: 0.95rem;
    margin: 0 0 0.5rem 0;
  }

  .warning {
    color: #666;
    font-size: 0.9rem;
    margin: 0 0 1.25rem 0;
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

  .cancel-button:hover {
    background: #d0d0d0;
  }

  .delete-button {
    flex: 1;
    background: #d32f2f;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .delete-button:hover {
    background: #b71c1c;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
  }

  .delete-button:active {
    transform: translateY(0);
  }
</style>
