<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Hsl } from '@sparkly/common';
  import { COLOR_PRESETS, handlePresetGridKeydown, type ColorPreset } from '../utils/ColorPresets';

  interface Props {
    value: Hsl;
    disabled?: boolean;
    fullWidth?: boolean;
    showValueLabel?: boolean;
    triggerId?: string;
  }

  const dispatch = createEventDispatcher<{ change: Hsl; ready: HTMLButtonElement | null }>();

  let { value, disabled = false, fullWidth = true, showValueLabel = true, triggerId }: Props = $props();

  const INITIAL_COLOR: Hsl = { hue: 0, saturation: 0, lightness: 0 };
  let internalValue: Hsl = $state(INITIAL_COLOR);
  let isOpen = $state(false);
  let containerElement: HTMLDivElement | null = null;
  let swatchButton: HTMLButtonElement | null = null;

  const clamp = (val: number, min = 0, max = 1) => Math.min(max, Math.max(min, val));

  function areHslEqual(a: Hsl, b: Hsl) {
    const EPSILON = 0.0001;
    return (
      Math.abs(a.hue - b.hue) < EPSILON &&
      Math.abs(a.saturation - b.saturation) < EPSILON &&
      Math.abs(a.lightness - b.lightness) < EPSILON
    );
  }

  $effect(() => {
    if (!areHslEqual(internalValue, value)) {
      internalValue = value;
    }
  });

  const toCssHsl = (color: Hsl) => {
    const hue = Math.round(clamp(color.hue) * 360);
    const saturation = Math.round(clamp(color.saturation) * 100);
    const lightness = Math.round(clamp(color.lightness) * 100);
    return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
  };

  const hueDegrees = $derived(Math.round(clamp(internalValue.hue) * 360));
  const saturationPercent = $derived(Math.round(clamp(internalValue.saturation) * 100));
  const lightnessPercent = $derived(Math.round(clamp(internalValue.lightness) * 100));
  const swatchColor = $derived(toCssHsl(internalValue));

  const saturationGradient = $derived(
    `linear-gradient(90deg, hsl(${hueDegrees}deg 0% ${lightnessPercent}%), hsl(${hueDegrees}deg 100% ${lightnessPercent}%))`
  );
  const lightnessGradient = $derived(
    `linear-gradient(90deg, hsl(${hueDegrees}deg ${saturationPercent}% 0%), hsl(${hueDegrees}deg ${saturationPercent}% 50%), hsl(${hueDegrees}deg ${saturationPercent}% 100%))`
  );

  function toggleOpen() {
    if (disabled) return;
    isOpen = !isOpen;
  }

  function closePicker() {
    isOpen = false;
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!isOpen) return;
    if (!containerElement) return;
    if (containerElement.contains(event.target as Node)) return;
    closePicker();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      closePicker();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  $effect(() => {
    dispatch('ready', swatchButton);
  });

  onDestroy(() => {
    dispatch('ready', null);
  });

  function handleSliderChange(key: keyof Hsl, rawValue: number) {
    const normalized = key === 'hue' ? rawValue / 360 : rawValue / 100;
    const nextValue: Hsl = {
      ...internalValue,
      [key]: clamp(normalized),
    } as Hsl;
    internalValue = nextValue;
    dispatch('change', nextValue);
  }

  function formatDisplay(color: Hsl) {
    return `${Math.round(clamp(color.hue) * 360)}° / ${Math.round(clamp(color.saturation) * 100)}% / ${Math.round(clamp(color.lightness) * 100)}%`;
  }

  // ── Preset selection ──

  let presetButtons: HTMLButtonElement[] = $state([]);
  let focusedPresetIndex = $state(-1);

  function selectPreset(preset: ColorPreset) {
    const nextValue: Hsl = { ...preset.hsl };
    internalValue = nextValue;
    dispatch('change', nextValue);
  }

  function isPresetActive(preset: ColorPreset): boolean {
    return areHslEqual(internalValue, preset.hsl);
  }

  function focusPreset(index: number) {
    focusedPresetIndex = index;
    presetButtons[index]?.focus();
  }

  function handlePresetKeydown(event: KeyboardEvent, index: number) {
    handlePresetGridKeydown(event, index, COLOR_PRESETS.length, focusPreset);
  }
</script>

<div class={`hsl-picker${fullWidth ? '' : ' compact'}`} bind:this={containerElement}>
  <button
    type="button"
    class={`swatch-button${fullWidth ? '' : ' compact'}`}
    id={triggerId}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label="Select color"
    {disabled}
    onclick={toggleOpen}
    bind:this={swatchButton}
  >
    <span class="swatch" style={`background: ${swatchColor};`}></span>
    {#if showValueLabel}
      <span class="swatch-label">{formatDisplay(internalValue)}</span>
    {/if}
  </button>

  {#if isOpen}
    <div class="picker-panel" role="dialog" aria-label="HSL color picker">
      <div class="preset-grid" role="toolbar" aria-label="Preset colors">
        {#each COLOR_PRESETS as preset, i}
          <button
            type="button"
            class="preset-swatch"
            class:active={isPresetActive(preset)}
            title={preset.name}
            aria-label={preset.name}
            tabindex={focusedPresetIndex === i || (focusedPresetIndex === -1 && i === 0) ? 0 : -1}
            style="background: {toCssHsl(preset.hsl)};{preset.hsl.lightness >= 0.95 ? ' border-color: #bbb;' : ''}"
            onclick={() => selectPreset(preset)}
            onkeydown={(e) => handlePresetKeydown(e, i)}
            bind:this={presetButtons[i]}
          ></button>
        {/each}
      </div>

      <div class="slider-group">
        <label for="hue-slider">Hue</label>
        <div class="slider-row">
          <input
            id="hue-slider"
            type="range"
            min="0"
            max="360"
            value={hueDegrees}
            style="background: linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta, red);"
            oninput={(event) => handleSliderChange('hue', Number(event.currentTarget.value))}
          />
          <span>{hueDegrees}°</span>
        </div>
      </div>

      <div class="slider-group">
        <label for="saturation-slider">Saturation</label>
        <div class="slider-row">
          <input
            id="saturation-slider"
            type="range"
            min="0"
            max="100"
            value={saturationPercent}
            style={`background: ${saturationGradient};`}
            oninput={(event) => handleSliderChange('saturation', Number(event.currentTarget.value))}
          />
          <span>{saturationPercent}%</span>
        </div>
      </div>

      <div class="slider-group">
        <label for="lightness-slider">Lightness</label>
        <div class="slider-row">
          <input
            id="lightness-slider"
            type="range"
            min="0"
            max="100"
            value={lightnessPercent}
            style={`background: ${lightnessGradient};`}
            oninput={(event) => handleSliderChange('lightness', Number(event.currentTarget.value))}
          />
          <span>{lightnessPercent}%</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .hsl-picker {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .hsl-picker.compact {
    width: auto;
  }

  .swatch-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    background: #fff;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .swatch-button.compact {
    width: auto;
    min-width: 0;
    padding: 0.2rem 0.4rem;
  }

  .swatch-button:focus-visible {
    outline: 2px solid rgba(255, 62, 0, 0.4);
    outline-offset: 3px;
  }

  .swatch-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .swatch {
    width: 32px;
    height: 32px;
    border-radius: 0.45rem;
    border: 1px solid #ccc;
    flex-shrink: 0;
  }

  .swatch-button.compact .swatch {
    width: 28px;
    height: 28px;
  }

  .swatch-label {
    font-size: 0.9rem;
    color: #444;
    font-family: 'Space Grotesk', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  /* ── Preset grid ── */

  .preset-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .preset-swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    transition:
      transform 0.1s,
      border-color 0.15s,
      box-shadow 0.15s;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  }

  .preset-swatch:hover {
    transform: scale(1.18);
    border-color: #ff3e00;
  }

  .preset-swatch.active {
    border-color: #ff3e00;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.12),
      0 0 0 2px rgba(255, 62, 0, 0.3);
  }

  .preset-swatch:focus-visible {
    outline: 2px solid rgba(255, 62, 0, 0.4);
    outline-offset: 2px;
  }

  .picker-panel {
    position: absolute;
    z-index: 10;
    top: calc(100% + 0.35rem);
    left: 0;
    width: min(320px, 100%);
    padding: 0;
    overflow: hidden;
    border-radius: 0.75rem;
    border: 1px solid #ddd;
    background: #fff;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  }

  .hsl-picker.compact .picker-panel {
    width: min(320px, calc(100vw - 2rem));
  }

  .slider-group {
    padding: 0 1rem;
  }

  .slider-group:first-of-type {
    padding-top: 1rem;
  }

  .slider-group:last-of-type {
    padding-bottom: 1rem;
  }

  .slider-group + .slider-group {
    margin-top: 0.75rem;
  }

  .slider-group label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .slider-row input[type='range'] {
    flex: 1;
    appearance: none;
    height: 16px;
    border-radius: 999px;
    outline: none;
    background: #eee;
    cursor: pointer;
  }

  .slider-row input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ff3e00;
    border: 2px solid #fff;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  }

  .slider-row span {
    width: 60px;
    text-align: right;
    font-size: 0.85rem;
    color: #444;
  }

  @media (max-width: 480px) {
    .picker-panel {
      width: 100%;
    }
  }
</style>
