<script lang="ts">
  import type { OptionEffectParameter } from '@sparkly/common';

  interface Props {
    param: OptionEffectParameter;
    value: string;
    onchange: (value: string) => void;
    onregister?: (element: HTMLElement | null) => void;
  }

  let { param, value, onchange, onregister }: Props = $props();

  let containerEl: HTMLElement | null = null;

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
    const active = containerEl?.querySelector('[aria-checked="true"]') as HTMLElement | null;
    const fallback = containerEl?.querySelector('.option-tag') as HTMLElement | null;
    (active ?? fallback)?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = Array.from(containerEl?.querySelectorAll('.option-tag') ?? []) as HTMLElement[];
    const currentIdx = buttons.findIndex((btn) => btn === document.activeElement);
    if (currentIdx === -1) return;
    event.preventDefault();
    const nextIdx =
      event.key === 'ArrowRight' ? Math.min(currentIdx + 1, buttons.length - 1) : Math.max(currentIdx - 1, 0);
    buttons[nextIdx]?.focus();
  }
</script>

<div
  use:setupContainer
  class="control-group option-group"
  tabindex="-1"
  title={param.description}
  onfocus={handleContainerFocus}
>
  <strong>{param.name}:</strong>
  <div class="option-tags" role="radiogroup" tabindex="-1" aria-label={param.name} onkeydown={handleOptionKeyDown}>
    {#each param.options as option}
      <button
        class="option-tag"
        class:active={value === option.value}
        role="radio"
        aria-checked={value === option.value}
        tabindex={value === option.value ? 0 : -1}
        title={option.description ?? ''}
        onclick={() => onchange(option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .control-group {
    margin-bottom: 1rem;
  }

  .option-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    outline: none;
  }

  .option-group strong {
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .option-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .option-tag {
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg-tag);
    color: var(--color-text-label);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }

  .option-tag:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
    background: var(--color-accent-bg-light);
  }

  .option-tag:focus-visible {
    outline: 2px solid var(--color-accent-focus);
    outline-offset: 2px;
  }

  .option-tag.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-bg-card);
  }

  .option-tag.active:hover {
    background: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
    color: var(--color-bg-card);
  }
</style>
