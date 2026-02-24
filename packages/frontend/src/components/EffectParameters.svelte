<script lang="ts">
  import { backendClient } from '../FrontendApiClient';
  import { handleApiUpdate } from '../utils/ApiHelper';
  import { deviceStore } from '../stores/DeviceStore.svelte';
  import {
    ParameterType,
    ColorMode,
    type EffectParameter,
    type Hsl,
    type RgbFloat,
    type ColorValue,
    type RangeEffectParameter,
    type BooleanEffectParameter,
    type HslEffectParameter,
    type OptionEffectParameter,
    type RgbEffectParameter,
    type ColorEffectParameter,
    type MultiColorEffectParameter,
  } from '@twinkly-ts/common';
  import RangeParameter from './params/RangeParameter.svelte';
  import BooleanParameter from './params/BooleanParameter.svelte';
  import HslParameter from './params/HslParameter.svelte';
  import OptionParameter from './params/OptionParameter.svelte';
  import RgbParameter from './params/RgbParameter.svelte';
  import ColorParameter from './params/ColorParameter.svelte';
  import MultiColorParameter from './params/MultiColorParameter.svelte';

  interface Props {
    deviceId: string;
    parameters: EffectParameter[];
    updating: boolean;
  }

  let { deviceId, parameters, updating = $bindable() }: Props = $props();

  type ParameterValue = number | boolean | Hsl | string | Hsl[] | RgbFloat | ColorValue | ColorValue[];

  let parameterElements: (HTMLElement | null)[] = [];
  const optimisticValues = new Map<string, ParameterValue>();
  let optimisticVersion = $state(0);

  const THROTTLE_MS = 100;

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
    if (state.pendingValue !== null) {
      const nextValue = state.pendingValue;
      state.pendingValue = null;
      scheduleBackendUpdate(paramId, nextValue);
    }
  }

  function scheduleBackendUpdate(paramId: string, value: ParameterValue) {
    const state = getParamState(paramId);
    state.pendingValue = cloneValue(value);

    if (state.isRunning) return;

    const waitTime = Math.max(THROTTLE_MS - (Date.now() - state.lastSendTimestamp), 0);

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

  function cloneColorValue(cv: ColorValue): ColorValue {
    if (cv.mode === ColorMode.HSL) {
      return { mode: ColorMode.HSL, hsl: { ...cv.hsl } };
    }
    return { mode: ColorMode.RGB, rgb: { ...cv.rgb } };
  }

  function cloneValue(value: ParameterValue): ParameterValue {
    if (Array.isArray(value)) {
      // Detect ColorValue[] vs Hsl[]
      if (value.length > 0 && 'mode' in value[0]) {
        return (value as ColorValue[]).map(cloneColorValue);
      }
      return (value as Hsl[]).map((v) => ({ ...v })) as Hsl[];
    }
    if (typeof value === 'object') {
      // Deep-clone ColorValue (has nested hsl/rgb object)
      const cv = value as Record<string, unknown>;
      if ('mode' in cv) {
        return cloneColorValue(value as ColorValue);
      }
      return { ...value };
    }
    return value;
  }

  function areHslEqual(a: Hsl, b: Hsl) {
    const EPSILON = 0.0001;
    return (
      Math.abs(a.hue - b.hue) < EPSILON &&
      Math.abs(a.saturation - b.saturation) < EPSILON &&
      Math.abs(a.lightness - b.lightness) < EPSILON
    );
  }

  function areRgbEqual(a: RgbFloat, b: RgbFloat) {
    const EPSILON = 0.0001;
    return (
      Math.abs(a.red - b.red) < EPSILON && Math.abs(a.green - b.green) < EPSILON && Math.abs(a.blue - b.blue) < EPSILON
    );
  }

  function areColorValuesEqual(a: ColorValue, b: ColorValue): boolean {
    if (a.mode !== b.mode) return false;
    if (a.mode === ColorMode.HSL && b.mode === ColorMode.HSL) return areHslEqual(a.hsl, b.hsl);
    if (a.mode === ColorMode.RGB && b.mode === ColorMode.RGB) return areRgbEqual(a.rgb, b.rgb);
    return false;
  }

  function areValuesEqual(type: string, a: ParameterValue, b: ParameterValue): boolean {
    if (type === ParameterType.HSL) {
      return typeof a === 'object' && typeof b === 'object' && areHslEqual(a as Hsl, b as Hsl);
    }
    if (type === ParameterType.MULTI_HSL) {
      // Legacy: treat as MULTI_COLOR with HSL values
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return (a as Hsl[]).every((color, i) => areHslEqual(color, (b as Hsl[])[i]));
    }
    if (type === ParameterType.RGB) {
      return typeof a === 'object' && typeof b === 'object' && areRgbEqual(a as RgbFloat, b as RgbFloat);
    }
    if (type === ParameterType.COLOR) {
      return areColorValuesEqual(a as ColorValue, b as ColorValue);
    }
    if (type === ParameterType.MULTI_COLOR) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return (a as ColorValue[]).every((color, i) => areColorValuesEqual(color, (b as ColorValue[])[i]));
    }
    return a === b;
  }

  function getEffectiveValue(param: EffectParameter): ParameterValue {
    optimisticVersion; // read for reactivity
    return optimisticValues.get(param.id) ?? (param.value as ParameterValue);
  }

  $effect(() => {
    const currentParams = parameters ?? [];
    const validIds = new Set(currentParams.map((p) => p.id));

    let didChange = false;
    for (const param of currentParams) {
      const optimistic = optimisticValues.get(param.id);
      if (optimistic && areValuesEqual(param.type, param.value as ParameterValue, optimistic)) {
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

    if (didChange) bumpOptimisticVersion();
  });

  function updateParameter(param: EffectParameter, value: ParameterValue) {
    const nextValue = cloneValue(value);
    const effectiveValue = getEffectiveValue(param);
    if (areValuesEqual(param.type, effectiveValue, nextValue)) return;

    setOptimisticValue(param.id, nextValue);
    scheduleBackendUpdate(param.id, nextValue);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const target = event.target as HTMLElement;
    if (!sectionEl?.contains(target)) return;

    const paramContainer = target.closest('[data-param-index]') as HTMLElement | null;
    if (!paramContainer) return;

    const currentIndex = Number(paramContainer.dataset.paramIndex);
    if (isNaN(currentIndex)) return;

    event.preventDefault();

    const nextIndex =
      event.key === 'ArrowDown'
        ? Math.min(currentIndex + 1, parameterElements.length - 1)
        : Math.max(currentIndex - 1, 0);
    parameterElements[nextIndex]?.focus();
  }

  let sectionEl: HTMLElement | null = $state(null);

  $effect(() => {
    const el = sectionEl;
    if (!el) return;
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if parameters && parameters.length > 0}
  <div class="parameters-section" bind:this={sectionEl}>
    {#each parameters as param, index}
      <div data-param-index={index}>
        {#if param.type === ParameterType.RANGE}
          {@const typedParam = param as RangeEffectParameter}
          <RangeParameter
            param={typedParam}
            value={getEffectiveValue(param) as number}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.BOOLEAN}
          {@const typedParam = param as BooleanEffectParameter}
          <BooleanParameter
            param={typedParam}
            value={getEffectiveValue(param) as boolean}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.HSL}
          {@const typedParam = param as HslEffectParameter}
          <HslParameter
            param={typedParam}
            value={getEffectiveValue(param) as Hsl}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.OPTION}
          {@const typedParam = param as OptionEffectParameter}
          <OptionParameter
            param={typedParam}
            value={getEffectiveValue(param) as string}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.RGB}
          {@const typedParam = param as RgbEffectParameter}
          <RgbParameter
            param={typedParam}
            value={getEffectiveValue(param) as RgbFloat}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.COLOR}
          {@const typedParam = param as ColorEffectParameter}
          <ColorParameter
            param={typedParam}
            value={getEffectiveValue(param) as ColorValue}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {:else if param.type === ParameterType.MULTI_COLOR}
          {@const typedParam = param as MultiColorEffectParameter}
          <MultiColorParameter
            param={typedParam}
            value={getEffectiveValue(param) as ColorValue[]}
            onchange={(v) => updateParameter(param, v)}
            onregister={(el) => (parameterElements[index] = el)}
          />
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .parameters-section {
    border-top: 1px solid #eee;
    padding-top: 0.25rem;
    margin-top: 0.25rem;
  }
</style>
