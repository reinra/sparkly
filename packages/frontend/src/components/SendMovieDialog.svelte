<script lang="ts">
  import { backendClient } from '../FrontendApiClient';
  import type { MovieTaskProgressResponse } from '@sparkly/common';

  interface Props {
    deviceId: string;
    /** Called when the dialog should be closed */
    onclose: () => void;
  }

  let { deviceId, onclose }: Props = $props();

  let task = $state<MovieTaskProgressResponse | null>(null);
  let active = $state(false);
  let polling = $state(true);
  let pollTimer: number | null = null;

  const POLL_INTERVAL_MS = 400;

  async function pollStatus() {
    try {
      const result = await backendClient.getMovieStatus({
        query: { device_id: deviceId },
      });

      if (result.status === 200) {
        active = result.body.active;
        task = result.body.task;

        // Keep polling while task is active
        if (active) {
          schedulePoll();
        } else {
          polling = false;
        }
      } else {
        polling = false;
      }
    } catch (error) {
      console.error('Failed to poll movie status:', error);
      polling = false;
    }
  }

  function schedulePoll() {
    if (pollTimer !== null) return;
    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      pollStatus();
    }, POLL_INTERVAL_MS);
  }

  function cleanup() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  // Start polling on mount
  $effect(() => {
    pollStatus();
    return cleanup;
  });

  let statusLabel = $derived.by(() => {
    if (!task) return 'Starting...';
    switch (task.status) {
      case 'rendering':
        return 'Rendering frames...';
      case 'uploading':
        return 'Uploading to device...';
      case 'configuring':
        return 'Configuring device...';
      case 'completed':
        return 'Completed!';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  });

  let progressPercent = $derived.by(() => {
    if (!task) return 0;
    if (task.status === 'uploading' && task.uploadBytesTotal && task.uploadBytesTotal > 0) {
      return Math.round((task.uploadBytesSent / task.uploadBytesTotal) * 100);
    }
    return Math.round(task.progress * 100);
  });

  let showProgressBar = $derived(task?.status === 'rendering' || task?.status === 'uploading');

  let isInProgress = $derived(
    task?.status === 'rendering' || task?.status === 'uploading' || task?.status === 'configuring'
  );

  let isDone = $derived(task?.status === 'completed' || task?.status === 'error');

  let frameInfo = $derived.by(() => {
    if (!task) return '';
    if (task.status === 'rendering') {
      if (task.totalFrames) {
        return `${task.framesRendered} / ${task.totalFrames} frames`;
      }
      return `${task.framesRendered} frames`;
    }
    if (task.frameCount !== null) {
      return `${task.frameCount} frames`;
    }
    return '';
  });

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  let durationInfo = $derived.by(() => {
    if (!task || task.effectDurationMs === null || task.effectDurationMs === undefined) return '';
    return formatDuration(task.effectDurationMs);
  });

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  let uploadInfo = $derived.by(() => {
    if (!task || !task.uploadBytesTotal) return '';
    if (task.status === 'uploading') {
      return `${formatBytes(task.uploadBytesSent)} / ${formatBytes(task.uploadBytesTotal)}`;
    }
    return formatBytes(task.uploadBytesTotal);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onclick={isDone ? onclose : undefined}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog" onclick={(e) => e.stopPropagation()}>
    <h3>Send Movie</h3>

    {#if task}
      <div class="effect-name">{task.effectName}</div>

      <div class="status-row">
        <span
          class="status-icon"
          class:spinning={isInProgress}
          class:success={task.status === 'completed'}
          class:error={task.status === 'error'}
        >
          {#if task.status === 'completed'}
            &#10003;
          {:else if task.status === 'error'}
            &#10007;
          {:else}
            &#9881;
          {/if}
        </span>
        <span class="status-label">{statusLabel}</span>
      </div>

      {#if showProgressBar}
        <div class="progress-section">
          <div class="progress-track">
            <div class="progress-fill" style="width: {progressPercent}%"></div>
          </div>
          <span class="progress-label">{progressPercent}%</span>
        </div>
      {/if}

      {#if frameInfo || durationInfo}
        <div class="frame-info">
          {#if frameInfo}{frameInfo}{/if}
          {#if frameInfo && durationInfo}
            &middot;
          {/if}
          {#if durationInfo}{durationInfo}{/if}
        </div>
      {/if}

      {#if uploadInfo}
        <div class="frame-info">{uploadInfo}</div>
      {/if}

      {#if task.status === 'error' && task.error}
        <div class="error-message">{task.error}</div>
      {/if}
    {:else}
      <div class="status-row">
        <span class="status-icon spinning">&#9881;</span>
        <span class="status-label">Starting...</span>
      </div>
    {/if}

    {#if isDone}
      <button class="close-button" onclick={onclose}>Close</button>
    {/if}
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
    margin: 0 0 0.75rem 0;
    color: #ff3e00;
    font-size: 1.3rem;
  }

  .effect-name {
    color: #666;
    font-size: 0.95rem;
    margin-bottom: 1.25rem;
    font-style: italic;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    font-size: 1.1rem;
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

  .status-icon.success {
    color: #4caf50;
    font-size: 1.6rem;
    font-weight: bold;
  }

  .status-icon.error {
    color: #d32f2f;
    font-size: 1.6rem;
    font-weight: bold;
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

  .progress-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .progress-track {
    flex: 1;
    height: 14px;
    background-color: #e0e0e0;
    border-radius: 7px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff3e00, #ff6e40);
    border-radius: 7px;
    transition: width 0.3s ease-out;
  }

  .progress-label {
    min-width: 3.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #ff3e00;
  }

  .frame-info {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  .error-message {
    background: #ffebee;
    color: #c62828;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    margin: 0.75rem 0;
    border: 1px solid #ef9a9a;
  }

  .close-button {
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    margin-top: 1rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #e63900;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(255, 62, 0, 0.3);
  }

  .close-button:active {
    transform: translateY(0);
  }
</style>
