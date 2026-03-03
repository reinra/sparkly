<script lang="ts">
  import {
    ColorMode,
    type MultiColorEffectParameter,
    type ColorValue,
    type Hsl,
    type RgbFloat,
  } from '@sparkly/common';
  import ColorColorPicker from '../ColorColorPicker.svelte';
  import { formatHslDisplay } from '../../utils/HslUtils';
  import { formatRgbDisplay } from '../../utils/RgbUtils';

  interface Props {
    param: MultiColorEffectParameter;
    value: ColorValue[];
    onchange: (value: ColorValue[]) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  let containerEl: HTMLElement | null = null;
  let dragFromIndex: number | null = $state(null);
  let dragOverIndex: number | null = $state(null);
  let mouseDownTarget: HTMLElement | null = null;

  function setupContainer(node: HTMLElement) {
    containerEl = node;
    onregister?.(node);
    return {
      destroy() {
        containerEl = null;
        onregister?.(null);
      },
    };
  }

  function handleContainerFocus(event: FocusEvent) {
    if (event.target !== containerEl) return;
    const firstFocusable = containerEl?.querySelector('button, [tabindex="0"]') as HTMLElement | null;
    firstFocusable?.focus();
  }

  function cloneColorValue(cv: ColorValue): ColorValue {
    if (cv.mode === ColorMode.HSL) {
      return { mode: ColorMode.HSL, hsl: { ...cv.hsl } };
    }
    return { mode: ColorMode.RGB, rgb: { ...cv.rgb } };
  }

  function cloneColors(): ColorValue[] {
    return value.map(cloneColorValue);
  }

  function updateColor(colorIndex: number, newColor: ColorValue) {
    const colors = cloneColors();
    colors[colorIndex] = cloneColorValue(newColor);
    onchange(colors);
  }

  function addColor() {
    const colors = cloneColors();
    colors.push(cloneColorValue(colors[colors.length - 1]));
    onchange(colors);
  }

  function removeColor(colorIndex: number) {
    if (value.length <= 1) return;
    const colors = cloneColors();
    colors.splice(colorIndex, 1);
    onchange(colors);
  }

  function handleMouseDown(event: MouseEvent) {
    mouseDownTarget = event.target as HTMLElement;
  }

  function handleDragStart(event: DragEvent, colorIndex: number) {
    if (!mouseDownTarget?.closest('.drag-handle')) {
      event.preventDefault();
      return;
    }
    dragFromIndex = colorIndex;
  }

  function handleDragOver(event: DragEvent, colorIndex: number) {
    event.preventDefault();
    dragOverIndex = colorIndex;
  }

  function handleDrop(toIndex: number) {
    if (dragFromIndex === null || dragFromIndex === toIndex) {
      resetDrag();
      return;
    }
    const colors = cloneColors();
    const [moved] = colors.splice(dragFromIndex, 1);
    colors.splice(toIndex, 0, moved);
    onchange(colors);
    resetDrag();
  }

  function resetDrag() {
    dragFromIndex = null;
    dragOverIndex = null;
  }

  function formatColorDisplay(cv: ColorValue): string {
    if (cv.mode === ColorMode.HSL) {
      return formatHslDisplay(cv.hsl);
    }
    return formatRgbDisplay(cv.rgb);
  }

  function handleListKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const target = event.target as HTMLElement;
    const row = target.closest('.multi-color-row') as HTMLElement | null;
    if (!row) return;

    const rows = Array.from(containerEl?.querySelectorAll('.multi-color-row') ?? []);
    const currentIndex = rows.indexOf(row);
    if (currentIndex === -1) return;

    const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;

    // At boundary, let the event propagate to parent for inter-parameter navigation
    if (nextIndex < 0 || nextIndex >= rows.length) return;

    event.preventDefault();
    event.stopPropagation();

    const targetRow = rows[nextIndex] as HTMLElement;
    const focusables = Array.from(targetRow.querySelectorAll('button, [tabindex="0"]')) as HTMLElement[];
    const currentFocusables = Array.from(row.querySelectorAll('button, [tabindex="0"]')) as HTMLElement[];
    const focusIndex = currentFocusables.indexOf(target);

    if (focusIndex >= 0 && focusIndex < focusables.length) {
      focusables[focusIndex]?.focus();
    } else {
      (focusables[0] ?? targetRow)?.focus();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  use:setupContainer
  class="control-group multi-color-group"
  tabindex="-1"
  title={param.description}
  role="list"
  aria-label={param.name}
  onfocus={handleContainerFocus}
  onkeydown={handleListKeyDown}
>
  <div class="multi-color-label"><strong>{param.name}</strong></div>
  <div class="multi-color-list">
    {#each value as color, colorIndex}
      {@const colorTriggerId = `color-picker-${param.id}-${colorIndex}`}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="multi-color-row"
        class:drag-over={dragOverIndex === colorIndex}
        draggable="true"
        onmousedown={handleMouseDown}
        ondragstart={(e) => handleDragStart(e, colorIndex)}
        ondragover={(e) => handleDragOver(e, colorIndex)}
        ondrop={() => handleDrop(colorIndex)}
        ondragend={resetDrag}
        onclick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest('.drag-handle') ||
            target.closest('.multi-color-remove') ||
            target.closest('.color-picker-cell')
          )
            return;
          e.stopPropagation();
          document.getElementById(colorTriggerId)?.click();
        }}
        role="listitem"
      >
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>
        <div class="color-picker-cell">
          <ColorColorPicker
            triggerId={colorTriggerId}
            value={color}
            fullWidth={false}
            showValueLabel={false}
            on:change={(event) => updateColor(colorIndex, event.detail)}
          />
        </div>
        <span class="mode-badge">{color.mode === ColorMode.HSL ? 'HSL' : 'RGB'}</span>
        <span class="color-readout">
          {formatColorDisplay(color)}
        </span>
        {#if value.length > 1}
          <button
            class="multi-color-remove"
            title="Remove color"
            aria-label={`Remove color ${colorIndex + 1}`}
            onclick={() => removeColor(colorIndex)}>✕</button
          >
        {:else}
          <span class="multi-color-remove-spacer"></span>
        {/if}
      </div>
    {/each}
  </div>
  <button class="multi-color-add" onclick={addColor}>+ Add Color</button>
</div>

<style>
  .control-group {
    margin-bottom: 1rem;
  }

  .multi-color-group {
    display: block;
    padding: 0.35rem 0;
    outline: none;
  }

  .multi-color-label {
    color: #666;
    margin-bottom: 0.4rem;
  }

  .multi-color-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .multi-color-row {
    display: grid;
    grid-template-columns: auto auto auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.2rem 0.3rem;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .multi-color-row:hover {
    background: #f8f8f8;
  }

  .multi-color-row.drag-over {
    background: #fff4f0;
    outline: 2px dashed #ff3e00;
    outline-offset: -2px;
  }

  .drag-handle {
    cursor: grab;
    color: #bbb;
    font-size: 1.1rem;
    line-height: 1;
    user-select: none;
    padding: 0 0.1rem;
  }

  .drag-handle:hover {
    color: #888;
  }

  .color-picker-cell {
    justify-self: start;
    width: max-content;
  }

  .color-picker-cell :global(.swatch-button) {
    width: auto;
  }

  .mode-badge {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #888;
    background: #f0f0f0;
    border-radius: 0.3rem;
    padding: 0.1rem 0.35rem;
    line-height: 1.2;
    user-select: none;
  }

  .color-readout {
    font-size: 0.85rem;
    color: #444;
    font-family: 'Space Grotesk', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    white-space: nowrap;
    justify-self: end;
    text-align: right;
  }

  .multi-color-remove {
    background: none;
    border: 1px solid transparent;
    border-radius: 0.3rem;
    color: #bbb;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.15rem 0.35rem;
    transition: all 0.15s ease;
    line-height: 1;
  }

  .multi-color-remove:hover {
    color: #e03500;
    border-color: #e03500;
    background: #fff4f0;
  }

  .multi-color-remove-spacer {
    width: 28px;
  }

  .multi-color-add {
    margin-top: 0.35rem;
    padding: 0.3rem 0.7rem;
    border: 1px dashed #ccc;
    border-radius: 999px;
    background: #fafafa;
    color: #888;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .multi-color-add:hover {
    border-color: #ff3e00;
    color: #ff3e00;
    background: #fff4f0;
  }

  .multi-color-add:focus-visible {
    outline: 2px solid rgba(255, 62, 0, 0.3);
    outline-offset: 2px;
  }
</style>
