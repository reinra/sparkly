<script lang="ts">
  import type { RgbEffectParameter, RgbFloat } from '@sparkly/common';
  import RgbColorPicker from '../RgbColorPicker.svelte';
  import { formatRgbDisplay } from '../../utils/RgbUtils';

  interface Props {
    param: RgbEffectParameter;
    value: RgbFloat;
    onchange: (value: RgbFloat) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  let swatchButton: HTMLButtonElement | null = null;

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
      <RgbColorPicker
        triggerId={`color-picker-${param.id}`}
        {value}
        fullWidth={false}
        showValueLabel={false}
        on:change={(event) => onchange(event.detail)}
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
    <span
      class="color-readout color-trigger"
      role="button"
      tabindex="0"
      aria-label={`Edit ${param.name} color value`}
      onclick={activatePicker}
      onkeydown={handleTriggerKey}
    >
      {formatRgbDisplay(value)}
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
