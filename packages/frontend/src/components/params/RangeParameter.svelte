<script lang="ts">
  import type { RangeEffectParameter } from '@twinkly-ts/common';

  interface Props {
    param: RangeEffectParameter;
    value: number;
    onchange: (value: number) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  function registerElement(node: HTMLElement) {
    onregister?.(node);
    return {
      destroy() {
        onregister?.(null);
      }
    };
  }

  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    onchange(Number(event.currentTarget.value));
  }
</script>

<div class="control-group" title={param.description}>
  <label for={param.id}>
    <strong>{param.name}:</strong>
    {param.step && param.step < 1 ? value.toFixed(1) : value}{param.unit || ''}
  </label>
  <input
    use:registerElement
    id={param.id}
    type="range"
    min={param.min}
    max={param.max}
    step={param.step || 1}
    {value}
    oninput={handleInput}
  />
</div>

<style>
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
</style>
