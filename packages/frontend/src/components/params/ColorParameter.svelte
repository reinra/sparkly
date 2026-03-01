<script lang="ts">
  import { ColorMode, type ColorEffectParameter, type ColorValue, type Hsl, type RgbFloat } from '@sparkly/common';
  import ColorColorPicker from '../ColorColorPicker.svelte';
  import { formatHslDisplay } from '../../utils/HslUtils';
  import { formatRgbDisplay } from '../../utils/RgbUtils';

  interface Props {
    param: ColorEffectParameter;
    value: ColorValue;
    onchange: (value: ColorValue) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  let swatchButton: HTMLButtonElement | null = null;

  const isHsl = $derived(value.mode === ColorMode.HSL);

  const displayText = $derived(
    isHsl
      ? formatHslDisplay((value as { mode: 'hsl'; hsl: Hsl }).hsl)
      : formatRgbDisplay((value as { mode: 'rgb'; rgb: RgbFloat }).rgb)
  );

  function handleColorChange(event: CustomEvent<ColorValue>) {
    onchange(event.detail);
  }

  function activatePicker(event?: MouseEvent | KeyboardEvent) {
    if (event) {
      event.preventDefault();
      if (event instanceof MouseEvent) event.stopPropagation();
    }
    swatchButton?.focus();
    swatchButton?.click();
  }

  function handleTriggerKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      activatePicker(event);
    }
  }
</script>

<div class="control-group color-group" title={param.description}>
  <div class="color-row" aria-live="polite">
    <div class="color-picker-cell">
      <ColorColorPicker
        triggerId={`color-picker-${param.id}`}
        {value}
        fullWidth={false}
        showValueLabel={false}
        on:change={handleColorChange}
        on:ready={(event) => {
          swatchButton = event.detail;
          onregister?.(event.detail);
        }}
      />
    </div>
    <span
      class="color-name color-trigger"
      role="button"
      tabindex="0"
      aria-label={`Edit ${param.name} color`}
      onclick={activatePicker}
      onkeydown={handleTriggerKey}
    >
      <strong>{param.name}</strong>
    </span>
    <span class="mode-label">{isHsl ? 'HSL' : 'RGB'}</span>
    <span
      class="color-readout color-trigger"
      role="button"
      tabindex="0"
      aria-label={`Edit ${param.name} color value`}
      onclick={activatePicker}
      onkeydown={handleTriggerKey}
    >
      {displayText}
    </span>
  </div>
</div>

<style>
  .control-group {
    margin-bottom: 1rem;
  }

  .color-group {
    display: block;
    padding: 0.35rem 0;
  }

  .color-row {
    display: grid;
    grid-template-columns: auto 1fr auto minmax(110px, auto);
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

  .mode-label {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.4rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f9f9f9;
    color: #888;
    user-select: none;
    line-height: 1.2;
    white-space: nowrap;
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

    .mode-label {
      justify-self: start;
    }
  }
</style>
