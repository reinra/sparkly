<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { RgbFloat } from '@sparkly/common';

  interface Props {
    value: RgbFloat;
    disabled?: boolean;
    fullWidth?: boolean;
    showValueLabel?: boolean;
    triggerId?: string;
  }

  const dispatch = createEventDispatcher<{ change: RgbFloat; ready: HTMLButtonElement | null }>();

  let { value, disabled = false, fullWidth = true, showValueLabel = true, triggerId }: Props = $props();

  const INITIAL_COLOR: RgbFloat = { red: 0, green: 0, blue: 0 };
  let internalValue: RgbFloat = $state(INITIAL_COLOR);
  let isOpen = $state(false);
  let containerElement: HTMLDivElement | null = null;
  let swatchButton: HTMLButtonElement | null = null;

  const clamp = (val: number, min = 0, max = 1) => Math.min(max, Math.max(min, val));

  function areRgbEqual(a: RgbFloat, b: RgbFloat) {
    const EPSILON = 0.0001;
    return (
      Math.abs(a.red - b.red) < EPSILON && Math.abs(a.green - b.green) < EPSILON && Math.abs(a.blue - b.blue) < EPSILON
    );
  }

  $effect(() => {
    if (!areRgbEqual(internalValue, value)) {
      internalValue = value;
    }
  });

  const toCssRgb = (color: RgbFloat) => {
    const r = Math.round(clamp(color.red) * 255);
    const g = Math.round(clamp(color.green) * 255);
    const b = Math.round(clamp(color.blue) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const red8bit = $derived(Math.round(clamp(internalValue.red) * 255));
  const green8bit = $derived(Math.round(clamp(internalValue.green) * 255));
  const blue8bit = $derived(Math.round(clamp(internalValue.blue) * 255));
  const swatchColor = $derived(toCssRgb(internalValue));

  const redGradient = $derived(
    `linear-gradient(90deg, rgb(0, ${green8bit}, ${blue8bit}), rgb(255, ${green8bit}, ${blue8bit}))`
  );
  const greenGradient = $derived(
    `linear-gradient(90deg, rgb(${red8bit}, 0, ${blue8bit}), rgb(${red8bit}, 255, ${blue8bit}))`
  );
  const blueGradient = $derived(
    `linear-gradient(90deg, rgb(${red8bit}, ${green8bit}, 0), rgb(${red8bit}, ${green8bit}, 255))`
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

  function handleSliderChange(key: keyof RgbFloat, rawValue: number) {
    const normalized = rawValue / 255;
    const nextValue: RgbFloat = {
      ...internalValue,
      [key]: clamp(normalized),
    } as RgbFloat;
    internalValue = nextValue;
    dispatch('change', nextValue);
  }

  function formatDisplay(color: RgbFloat) {
    return `${Math.round(clamp(color.red) * 255)} / ${Math.round(clamp(color.green) * 255)} / ${Math.round(clamp(color.blue) * 255)}`;
  }
</script>

<div class={`rgb-picker${fullWidth ? '' : ' compact'}`} bind:this={containerElement}>
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
    <div class="picker-panel" role="dialog" aria-label="RGB color picker">
      <div class="slider-group">
        <label for="red-slider">Red</label>
        <div class="slider-row">
          <input
            id="red-slider"
            type="range"
            min="0"
            max="255"
            value={red8bit}
            style={`background: ${redGradient};`}
            oninput={(event) => handleSliderChange('red', Number(event.currentTarget.value))}
          />
          <span>{red8bit}</span>
        </div>
      </div>

      <div class="slider-group">
        <label for="green-slider">Green</label>
        <div class="slider-row">
          <input
            id="green-slider"
            type="range"
            min="0"
            max="255"
            value={green8bit}
            style={`background: ${greenGradient};`}
            oninput={(event) => handleSliderChange('green', Number(event.currentTarget.value))}
          />
          <span>{green8bit}</span>
        </div>
      </div>

      <div class="slider-group">
        <label for="blue-slider">Blue</label>
        <div class="slider-row">
          <input
            id="blue-slider"
            type="range"
            min="0"
            max="255"
            value={blue8bit}
            style={`background: ${blueGradient};`}
            oninput={(event) => handleSliderChange('blue', Number(event.currentTarget.value))}
          />
          <span>{blue8bit}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .rgb-picker {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .rgb-picker.compact {
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
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #ddd;
    background: #fff;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  }

  .rgb-picker.compact .picker-panel {
    width: min(320px, calc(100vw - 2rem));
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
