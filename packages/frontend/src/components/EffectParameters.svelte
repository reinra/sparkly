<script lang="ts">
  import { backendClient } from '../frontendApiClient';
  import { handleApiUpdate } from '../utils/apiHelper';
  import { deviceStore } from '../stores/deviceStore.svelte';
  import HslColorPicker from './HslColorPicker.svelte';
  import { ParameterType, type EffectParameter, type Hsl } from '@twinkly-ts/common';

  interface Props {
    deviceId: string;
    parameters: EffectParameter[];
    updating: boolean;
  }

  let { deviceId, parameters, updating = $bindable() }: Props = $props();

  type ParameterValue = number | boolean | Hsl;

  let parameterElements: (HTMLElement | null)[] = [];
  const optimisticValues = new Map<string, ParameterValue>();
  let optimisticVersion = 0;

  const THROTTLE_MS = 100;
  const COLOR_PICKER_ID_PREFIX = 'color-picker-';

  type ParameterBackendState = {
    isRunning: boolean;
    scheduledTimeout: ReturnType<typeof setTimeout> | null;
    pendingValue: ParameterValue | null;
    lastSendTimestamp: number;
  };

  const parameterBackendState = new Map<string, ParameterBackendState>();

  function bumpOptimisticVersion() {
    optimisticVersion += 1;
  }

  function setOptimisticValue(id: string, value: ParameterValue) {
    optimisticValues.set(id, cloneValue(value));
    bumpOptimisticVersion();
  }

  function clearOptimisticValue(id: string) {
    if (optimisticValues.delete(id)) {
      bumpOptimisticVersion();
    }
  }

  function getParamState(paramId: string) {
    if (!parameterBackendState.has(paramId)) {
      parameterBackendState.set(paramId, {
        isRunning: false,
        scheduledTimeout: null,
        pendingValue: null,
        lastSendTimestamp: 0,
      });
    }
    return parameterBackendState.get(paramId)!;
  }

  async function sendBackendUpdate(paramId: string, value: ParameterValue) {
    const state = getParamState(paramId);
    state.isRunning = true;
    state.pendingValue = null;
    state.lastSendTimestamp = Date.now();

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
    const hasPending = state.pendingValue !== null;
    if (hasPending) {
      const nextValue = state.pendingValue;
      state.pendingValue = null;
      if (nextValue !== null) {
        scheduleBackendUpdate(paramId, nextValue);
      }
    }
  }

  function scheduleBackendUpdate(paramId: string, value: ParameterValue) {
    const state = getParamState(paramId);
    const preparedValue = cloneValue(value);
    state.pendingValue = preparedValue;

    if (state.isRunning) {
      return;
    }

    const now = Date.now();
    const elapsed = now - state.lastSendTimestamp;
    const waitTime = Math.max(THROTTLE_MS - elapsed, 0);

    if (state.scheduledTimeout !== null) {
      clearTimeout(state.scheduledTimeout);
    }

    state.scheduledTimeout = setTimeout(() => {
      state.scheduledTimeout = null;
      const nextValue = state.pendingValue;
      if (nextValue === null) return;
      state.pendingValue = null;
      sendBackendUpdate(paramId, nextValue);
    }, waitTime);
  }

  function areHslEqual(a: Hsl, b: Hsl) {
    const EPSILON = 0.0001;
    return (
      Math.abs(a.hue - b.hue) < EPSILON &&
      Math.abs(a.saturation - b.saturation) < EPSILON &&
      Math.abs(a.lightness - b.lightness) < EPSILON
    );
  }

  function formatHslDisplay(color: Hsl) {
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const hue = Math.round(clamp(color.hue) * 360);
    const saturation = Math.round(clamp(color.saturation) * 100);
    const lightness = Math.round(clamp(color.lightness) * 100);
    return `${hue}° / ${saturation}% / ${lightness}%`;
  }

  function cloneValue(value: ParameterValue): ParameterValue {
    if (typeof value === 'object') {
      return { ...(value as Hsl) };
    }
    return value;
  }

  function valuesMatch(param: EffectParameter, value: ParameterValue) {
    if (param.type === ParameterType.RANGE && typeof value === 'number') {
      return param.value === value;
    }
    if (param.type === ParameterType.BOOLEAN && typeof value === 'boolean') {
      return param.value === value;
    }
    if (param.type === ParameterType.HSL && typeof value === 'object') {
      return areHslEqual(param.value as Hsl, value as Hsl);
    }
    return false;
  }

  function getEffectiveValue(param: EffectParameter): ParameterValue {
    optimisticVersion;
    return optimisticValues.get(param.id) ?? (param.value as ParameterValue);
  }

  $effect(() => {
    const currentParams = parameters ?? [];
    const validIds = new Set(currentParams.map((param) => param.id));

    let didChange = false;
    for (const param of currentParams) {
      const optimistic = optimisticValues.get(param.id);
      if (optimistic && valuesMatch(param, optimistic)) {
        optimisticValues.delete(param.id);
        didChange = true;
      }
    }

    for (const id of Array.from(optimisticValues.keys())) {
      if (!validIds.has(id)) {
        optimisticValues.delete(id);
        didChange = true;
      }
    }

    if (didChange) {
      bumpOptimisticVersion();
    }
  });

  function updateParameter(param: EffectParameter, value: ParameterValue) {
    const nextValue = cloneValue(value);
    const effectiveValue = getEffectiveValue(param);

    if (param.type === ParameterType.HSL) {
      if (typeof nextValue !== 'object' || areHslEqual(effectiveValue as Hsl, nextValue as Hsl)) {
        return;
      }
    } else if (param.type === ParameterType.RANGE) {
      if (typeof nextValue !== 'number' || effectiveValue === nextValue) {
        return;
      }
    } else if (param.type === ParameterType.BOOLEAN) {
      if (typeof nextValue !== 'boolean' || effectiveValue === nextValue) {
        return;
      }
    }

    setOptimisticValue(param.id, nextValue);
    scheduleBackendUpdate(param.id, nextValue);
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
      return;
    }
  }

  function handleColorTriggerClick(event: MouseEvent, index: number, paramId: string) {
    event.preventDefault();
    event.stopPropagation();
    activateColorPicker(index, paramId);
  }

  function handleColorTriggerKey(event: KeyboardEvent, index: number, paramId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateColorPicker(index, paramId);
    }
  }

  function colorPickerTriggerId(paramId: string) {
    return `${COLOR_PICKER_ID_PREFIX}${paramId}`;
  }

  function getColorPickerButton(paramId: string) {
    return document.getElementById(colorPickerTriggerId(paramId)) as HTMLButtonElement | null;
  }

  function activateColorPicker(index: number, paramId: string) {
    const pickerButton =
      (parameterElements[index] as HTMLButtonElement | null) ?? getColorPickerButton(paramId);
    if (!pickerButton) return;
    parameterElements[index] = pickerButton;
    pickerButton.focus();
    pickerButton.click();
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if parameters && parameters.length > 0}
  <div class="parameters-section">
    <h4>Parameters</h4>
    {#each parameters as param, index}
      {#if param.type === ParameterType.RANGE}
        {@const rangeValue = getEffectiveValue(param) as number}
        <div class="control-group" title={param.description}>
          <label for={param.id}>
            <strong>{param.name}:</strong>
            {param.step && param.step < 1 ? rangeValue.toFixed(1) : rangeValue}{param.unit || ''}
          </label>
          <input
            bind:this={(parameterElements[index] as HTMLInputElement | null)}
            id={param.id}
            type="range"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={rangeValue}
            oninput={(event) => handleRangeChange(event, param)}
          />
        </div>
      {:else if param.type === ParameterType.BOOLEAN}
        {@const booleanValue = getEffectiveValue(param) as boolean}
        <div class="control-group checkbox-group" title={param.description}>
          <label for={param.id}>
            <input
              bind:this={(parameterElements[index] as HTMLInputElement | null)}
              id={param.id}
              type="checkbox"
              checked={booleanValue}
              onchange={(event) => handleCheckboxChange(event, param)}
            />
            <strong>{param.name}</strong>
          </label>
        </div>
      {:else if param.type === ParameterType.HSL}
        {@const hslValue = getEffectiveValue(param) as Hsl}
        <div class="control-group color-group" title={param.description}>
          <div class="color-row" aria-live="polite">
            <div class="color-picker-cell">
              <HslColorPicker
                triggerId={colorPickerTriggerId(param.id)}
                value={hslValue}
                fullWidth={false}
                showValueLabel={false}
                on:change={(event) => updateParameter(param, event.detail)}
                on:ready={(event) => {
                  parameterElements[index] = event.detail;
                }}
              />
            </div>
            <span
              class="color-name color-trigger"
              role="button"
              tabindex="0"
              aria-label={`Edit ${param.name} color`}
              onclick={(event) => handleColorTriggerClick(event, index, param.id)}
              onkeydown={(event) => handleColorTriggerKey(event, index, param.id)}
            >
              <strong>{param.name}</strong>
            </span>
            <span
              class="color-readout color-trigger"
              role="button"
              tabindex="0"
              aria-label={`Edit ${param.name} color value`}
              onclick={(event) => handleColorTriggerClick(event, index, param.id)}
              onkeydown={(event) => handleColorTriggerKey(event, index, param.id)}
            >
              {formatHslDisplay(hslValue)}
            </span>
          </div>
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

  .color-group {
    display: block;
    padding: 0.35rem 0;
  }

  .color-row {
    display: grid;
    grid-template-columns: auto 1fr minmax(110px, auto);
    gap: 0.5rem;
    align-items: center;
  }

  .color-trigger {
    cursor: pointer;
    user-select: none;
  }

  .color-trigger:focus-visible {
    outline: 2px solid rgba(255, 62, 0, 0.4);
    border-radius: 4px;
    padding: 0 0.15rem;
  }

  .color-name {
    color: #333;
  }

  .color-picker-cell {
    justify-self: start;
    width: max-content;
  }

  .color-picker-cell :global(.swatch-button) {
    width: auto;
  }

  .color-readout {
    font-size: 0.85rem;
    color: #444;
    font-family: 'Space Grotesk', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    white-space: nowrap;
    justify-self: end;
    text-align: right;
  }

  @media (max-width: 640px) {
    .color-row {
      grid-template-columns: 1fr;
    }

    .color-picker-cell,
    .color-readout {
      justify-self: start;
      width: 100%;
      text-align: left;
    }
  }
</style>
