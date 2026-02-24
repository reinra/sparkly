<script module lang="ts">
  // Shared across all ColorColorPicker instances – ensures only one picker is open at a time
  let closeCurrentPicker: (() => void) | null = null;
</script>

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { ColorMode, type ColorValue, type Hsl, type RgbFloat } from '@twinkly-ts/common';
  import { hslToRgbFloat, rgbFloatToHsl } from '../utils/ColorConvert';

  interface Props {
    value: ColorValue;
    disabled?: boolean;
    fullWidth?: boolean;
    showValueLabel?: boolean;
    triggerId?: string;
  }

  const dispatch = createEventDispatcher<{ change: ColorValue; ready: HTMLButtonElement | null }>();

  let { value, disabled = false, fullWidth = true, showValueLabel = true, triggerId }: Props = $props();

  let internalValue = $state<ColorValue>({ mode: ColorMode.HSL, hsl: { hue: 0, saturation: 0, lightness: 0 } });
  let isOpen = $state(false);
  let containerElement: HTMLDivElement | null = null;
  let swatchButton: HTMLButtonElement | null = null;

  const clamp = (val: number, min = 0, max = 1) => Math.min(max, Math.max(min, val));

  // ── Equality helpers ──

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

  // ── Sync external → internal ──

  $effect(() => {
    if (!areColorValuesEqual(internalValue, value)) {
      internalValue = value;
    }
  });

  // ── Derived: current tab + color representations ──

  const activeTab = $derived(internalValue.mode);

  const hslValue: Hsl = $derived(
    internalValue.mode === ColorMode.HSL ? internalValue.hsl : rgbFloatToHsl(internalValue.rgb)
  );

  const rgbValue: RgbFloat = $derived(
    internalValue.mode === ColorMode.RGB ? internalValue.rgb : hslToRgbFloat(internalValue.hsl)
  );

  // ── CSS color for swatch ──

  const toCssHsl = (color: Hsl) => {
    const hue = Math.round(clamp(color.hue) * 360);
    const sat = Math.round(clamp(color.saturation) * 100);
    const lit = Math.round(clamp(color.lightness) * 100);
    return `hsl(${hue}deg ${sat}% ${lit}%)`;
  };

  const swatchColor = $derived(toCssHsl(hslValue));

  // ── HSL slider derived values ──

  const hueDegrees = $derived(Math.round(clamp(hslValue.hue) * 360));
  const saturationPercent = $derived(Math.round(clamp(hslValue.saturation) * 100));
  const lightnessPercent = $derived(Math.round(clamp(hslValue.lightness) * 100));

  const saturationGradient = $derived(
    `linear-gradient(90deg, hsl(${hueDegrees}deg 0% ${lightnessPercent}%), hsl(${hueDegrees}deg 100% ${lightnessPercent}%))`
  );
  const lightnessGradient = $derived(
    `linear-gradient(90deg, hsl(${hueDegrees}deg ${saturationPercent}% 0%), hsl(${hueDegrees}deg ${saturationPercent}% 50%), hsl(${hueDegrees}deg ${saturationPercent}% 100%))`
  );

  // ── RGB slider derived values ──

  const red8bit = $derived(Math.round(clamp(rgbValue.red) * 255));
  const green8bit = $derived(Math.round(clamp(rgbValue.green) * 255));
  const blue8bit = $derived(Math.round(clamp(rgbValue.blue) * 255));

  const redGradient = $derived(
    `linear-gradient(90deg, rgb(0, ${green8bit}, ${blue8bit}), rgb(255, ${green8bit}, ${blue8bit}))`
  );
  const greenGradient = $derived(
    `linear-gradient(90deg, rgb(${red8bit}, 0, ${blue8bit}), rgb(${red8bit}, 255, ${blue8bit}))`
  );
  const blueGradient = $derived(
    `linear-gradient(90deg, rgb(${red8bit}, ${green8bit}, 0), rgb(${red8bit}, ${green8bit}, 255))`
  );

  // ── Display text ──

  function formatDisplay(cv: ColorValue): string {
    if (cv.mode === ColorMode.HSL) {
      const h = Math.round(clamp(cv.hsl.hue) * 360);
      const s = Math.round(clamp(cv.hsl.saturation) * 100);
      const l = Math.round(clamp(cv.hsl.lightness) * 100);
      return `${h}° / ${s}% / ${l}%`;
    }
    const r = Math.round(clamp(cv.rgb.red) * 255);
    const g = Math.round(clamp(cv.rgb.green) * 255);
    const b = Math.round(clamp(cv.rgb.blue) * 255);
    return `${r} / ${g} / ${b}`;
  }

  // ── Open / close ──

  function toggleOpen() {
    if (disabled) return;
    if (isOpen) {
      closePicker();
    } else {
      // Close any other open picker first
      if (closeCurrentPicker && closeCurrentPicker !== closePicker) {
        closeCurrentPicker();
      }
      isOpen = true;
      closeCurrentPicker = closePicker;
    }
  }

  function closePicker() {
    isOpen = false;
    if (closeCurrentPicker === closePicker) {
      closeCurrentPicker = null;
    }
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

  // ── Tab switching ──

  function switchTab(mode: 'hsl' | 'rgb') {
    if (mode === activeTab) return;
    // Convert current color to the other representation
    let next: ColorValue;
    if (mode === ColorMode.HSL) {
      next = { mode: ColorMode.HSL, hsl: rgbFloatToHsl(rgbValue) };
    } else {
      next = { mode: ColorMode.RGB, rgb: hslToRgbFloat(hslValue) };
    }
    internalValue = next;
    dispatch('change', next);
  }

  // ── Slider handlers ──

  function handleHslSliderChange(key: keyof Hsl, rawValue: number) {
    const normalized = key === 'hue' ? rawValue / 360 : rawValue / 100;
    const nextHsl: Hsl = { ...hslValue, [key]: clamp(normalized) };
    const next: ColorValue = { mode: ColorMode.HSL, hsl: nextHsl };
    internalValue = next;
    dispatch('change', next);
  }

  function handleRgbSliderChange(key: keyof RgbFloat, rawValue: number) {
    const normalized = rawValue / 255;
    const nextRgb: RgbFloat = { ...rgbValue, [key]: clamp(normalized) };
    const next: ColorValue = { mode: ColorMode.RGB, rgb: nextRgb };
    internalValue = next;
    dispatch('change', next);
  }
</script>

<div class={`color-picker${fullWidth ? '' : ' compact'}`} bind:this={containerElement}>
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
    <div class="picker-panel" role="dialog" aria-label="Color picker">
      <!-- Tab bar -->
      <div class="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab-button"
          class:active={activeTab === ColorMode.HSL}
          aria-selected={activeTab === ColorMode.HSL}
          onclick={() => switchTab(ColorMode.HSL)}
        >
          HSL
        </button>
        <button
          type="button"
          role="tab"
          class="tab-button"
          class:active={activeTab === ColorMode.RGB}
          aria-selected={activeTab === ColorMode.RGB}
          onclick={() => switchTab(ColorMode.RGB)}
        >
          RGB
        </button>
      </div>

      <!-- HSL sliders -->
      {#if activeTab === ColorMode.HSL}
        <div class="sliders" role="tabpanel" aria-label="HSL sliders">
          <div class="slider-group">
            <label for="hue-slider-{triggerId}">Hue</label>
            <div class="slider-row">
              <input
                id="hue-slider-{triggerId}"
                type="range"
                min="0"
                max="360"
                value={hueDegrees}
                style="background: linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta, red);"
                oninput={(event) => handleHslSliderChange('hue', Number(event.currentTarget.value))}
              />
              <span>{hueDegrees}°</span>
            </div>
          </div>

          <div class="slider-group">
            <label for="sat-slider-{triggerId}">Saturation</label>
            <div class="slider-row">
              <input
                id="sat-slider-{triggerId}"
                type="range"
                min="0"
                max="100"
                value={saturationPercent}
                style={`background: ${saturationGradient};`}
                oninput={(event) => handleHslSliderChange('saturation', Number(event.currentTarget.value))}
              />
              <span>{saturationPercent}%</span>
            </div>
          </div>

          <div class="slider-group">
            <label for="lit-slider-{triggerId}">Lightness</label>
            <div class="slider-row">
              <input
                id="lit-slider-{triggerId}"
                type="range"
                min="0"
                max="100"
                value={lightnessPercent}
                style={`background: ${lightnessGradient};`}
                oninput={(event) => handleHslSliderChange('lightness', Number(event.currentTarget.value))}
              />
              <span>{lightnessPercent}%</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- RGB sliders -->
      {#if activeTab === ColorMode.RGB}
        <div class="sliders" role="tabpanel" aria-label="RGB sliders">
          <div class="slider-group">
            <label for="red-slider-{triggerId}">Red</label>
            <div class="slider-row">
              <input
                id="red-slider-{triggerId}"
                type="range"
                min="0"
                max="255"
                value={red8bit}
                style={`background: ${redGradient};`}
                oninput={(event) => handleRgbSliderChange('red', Number(event.currentTarget.value))}
              />
              <span>{red8bit}</span>
            </div>
          </div>

          <div class="slider-group">
            <label for="green-slider-{triggerId}">Green</label>
            <div class="slider-row">
              <input
                id="green-slider-{triggerId}"
                type="range"
                min="0"
                max="255"
                value={green8bit}
                style={`background: ${greenGradient};`}
                oninput={(event) => handleRgbSliderChange('green', Number(event.currentTarget.value))}
              />
              <span>{green8bit}</span>
            </div>
          </div>

          <div class="slider-group">
            <label for="blue-slider-{triggerId}">Blue</label>
            <div class="slider-row">
              <input
                id="blue-slider-{triggerId}"
                type="range"
                min="0"
                max="255"
                value={blue8bit}
                style={`background: ${blueGradient};`}
                oninput={(event) => handleRgbSliderChange('blue', Number(event.currentTarget.value))}
              />
              <span>{blue8bit}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .color-picker {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .color-picker.compact {
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

  .picker-panel {
    position: absolute;
    z-index: 10;
    top: calc(100% + 0.35rem);
    left: 0;
    width: min(320px, 100%);
    padding: 0;
    border-radius: 0.75rem;
    border: 1px solid #ddd;
    background: #fff;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .color-picker.compact .picker-panel {
    width: min(320px, calc(100vw - 2rem));
  }

  /* ── Tab bar ── */

  .tab-bar {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
  }

  .tab-button {
    flex: 1;
    padding: 0.5rem 0;
    border: none;
    background: #f7f7f7;
    color: #777;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
  }

  .tab-button:first-child {
    border-radius: 0.7rem 0 0 0;
  }

  .tab-button:last-child {
    border-radius: 0 0.7rem 0 0;
  }

  .tab-button:hover:not(.active) {
    background: #eee;
  }

  .tab-button.active {
    background: #fff;
    color: #333;
    box-shadow: inset 0 -2px 0 #ff3e00;
  }

  .tab-button:focus-visible {
    outline: 2px solid rgba(255, 62, 0, 0.4);
    outline-offset: -2px;
  }

  /* ── Sliders ── */

  .sliders {
    padding: 1rem;
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
