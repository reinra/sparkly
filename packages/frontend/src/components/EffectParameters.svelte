<script lang="ts">
  import { backendClient } from '../frontendApiClient';
  import { handleApiUpdate } from '../utils/apiHelper';
  import { deviceStore } from '../stores/deviceStore.svelte';
  import { ParameterType, type EffectParameter } from '@twinkly-ts/common';

  interface Props {
    deviceId: string;
    parameters: EffectParameter[];
    updating: boolean;
  }

  let { deviceId, parameters, updating = $bindable() }: Props = $props();

  let parameterElements: (HTMLInputElement | null)[] = [];

  // Track backend call state per parameter
  const parameterBackendState = new Map<string, {
    isRunning: boolean;
    scheduledTimeout: number | null;
    pendingValue: number | boolean | null;
  }>();

  function getParamState(paramId: string) {
    if (!parameterBackendState.has(paramId)) {
      parameterBackendState.set(paramId, {
        isRunning: false,
        scheduledTimeout: null,
        pendingValue: null,
      });
    }
    return parameterBackendState.get(paramId)!;
  }

  async function sendBackendUpdate(paramId: string, value: number | boolean) {
    const state = getParamState(paramId);
    state.isRunning = true;
    state.pendingValue = null;

    await handleApiUpdate(
      () =>
        backendClient.setParameters({
          body: {
            device_id: deviceId,
            parameters: [{ id: paramId, value }],
          },
        }),
      async () => {
        await deviceStore.fetchDevice(deviceId);
      },
      () => {}
    );

    state.isRunning = false;

    // If there's a pending value, schedule another update
    if (state.pendingValue !== null) {
      const nextValue = state.pendingValue;
      state.pendingValue = null;
      scheduleBackendUpdate(paramId, nextValue);
    }
  }

  function scheduleBackendUpdate(paramId: string, value: number | boolean) {
    const state = getParamState(paramId);

    if (state.isRunning) {
      // If already running, schedule for later (only keep one scheduled)
      if (state.scheduledTimeout !== null) {
        clearTimeout(state.scheduledTimeout);
      }
      state.pendingValue = value;
      state.scheduledTimeout = setTimeout(() => {
        state.scheduledTimeout = null;
        sendBackendUpdate(paramId, value);
      }, 100);
    } else {
      // If not running, start immediately
      sendBackendUpdate(paramId, value);
    }
  }

  function updateParameter(param: EffectParameter, value: number | boolean) {
    if (param.value === value) return;

    // Optimistic update - update local state immediately
    param.value = value;

    // Schedule backend update
    scheduleBackendUpdate(param.id, value);
  }

  function handleRangeChange(event: Event & { currentTarget: HTMLInputElement }, param: EffectParameter) {
    const value = Number(event.currentTarget.value);
    updateParameter(param, value);
  }

  function handleCheckboxChange(event: Event & { currentTarget: HTMLInputElement }, param: EffectParameter) {
    const value = event.currentTarget.checked;
    updateParameter(param, value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInParameters = target.closest('.parameters-section') !== null;

    if (!isInParameters || parameterElements.length === 0) return;

    // Find current focused parameter index
    const currentIndex = parameterElements.findIndex((el) => el === document.activeElement);
    if (currentIndex === -1) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, parameterElements.length - 1);
      parameterElements[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      parameterElements[prevIndex]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      // Let browser handle left/right for range inputs naturally
      return;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if parameters && parameters.length > 0}
  <div class="parameters-section">
    <h4>Parameters</h4>
    {#each parameters as param, index}
      {#if param.type === ParameterType.RANGE}
        <div class="control-group" title={param.description}>
          <label for={param.id}>
            <strong>{param.name}:</strong>
            {param.step && param.step < 1 ? param.value.toFixed(1) : param.value}{param.unit || ''}
          </label>
          <input
            bind:this={parameterElements[index]}
            id={param.id}
            type="range"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={param.value}
            oninput={(e) => handleRangeChange(e, param)}
          />
        </div>
      {:else if param.type === ParameterType.BOOLEAN}
        <div class="control-group checkbox-group" title={param.description}>
          <label for={param.id}>
            <input
              bind:this={parameterElements[index]}
              id={param.id}
              type="checkbox"
              checked={param.value}
              onchange={(e) => handleCheckboxChange(e, param)}
            />
            <strong>{param.name}</strong>
          </label>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .parameters-section {
    border-top: 1px solid #eee;
    padding-top: 0.25rem;
    margin-top: 0.25rem;
  }

  h4 {
    color: #ff3e00;
    font-size: 1.1rem;
    margin: 1.5rem 0 1rem 0;
  }

  .control-group {
    margin-bottom: 1rem;
  }

  .control-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #666;
  }

  input[type='range'] {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #ddd;
    outline: none;
    margin-top: 0.5rem;
    transition: background 0.2s ease;
  }

  input[type='range']:focus {
    background: #ff3e00;
    outline: 2px solid rgba(255, 62, 0, 0.3);
    outline-offset: 2px;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    cursor: pointer;
    transition: outline 0.2s ease;
  }

  input[type='checkbox']:focus {
    outline: 2px solid #ff3e00;
    outline-offset: 2px;
  }
</style>
