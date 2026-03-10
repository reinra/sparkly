<script lang="ts">
  import type { BooleanEffectParameter } from '@sparkly/common';

  interface Props {
    param: BooleanEffectParameter;
    value: boolean;
    onchange: (value: boolean) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  function registerElement(node: HTMLElement) {
    onregister?.(node);
    return {
      destroy() {
        onregister?.(null);
      },
    };
  }

  function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
    onchange(event.currentTarget.checked);
  }
</script>

<div class="control-group checkbox-group" title={param.description}>
  <label for={param.id}>
    <input use:registerElement id={param.id} type="checkbox" checked={value} onchange={handleChange} />
    <strong>{param.name}</strong>
  </label>
</div>

<style>
  .control-group {
    margin-bottom: 1rem;
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
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
