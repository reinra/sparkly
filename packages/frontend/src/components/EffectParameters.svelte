<script lang="ts">
  import { backendClient } from '../frontendApiClient';
  import { handleApiUpdate } from '../utils/apiHelper';
  import { deviceStore } from '../stores/deviceStore.svelte';
  import { ParameterType, type EffectParameter } from '@twinkly-ts/common';

  interface Props {
    deviceId: string;
    parameters: EffectParameter[];
    updating: boolean;
  }

  let { deviceId, parameters, updating = $bindable() }: Props = $props();

  async function updateParameter(param: EffectParameter, value: number | boolean) {
    if (updating) return;
    if (param.value === value) return;

    updating = true;
    await handleApiUpdate(
      () =>
        backendClient.setParameters({
          body: {
            device_id: deviceId,
            parameters: [{ id: param.id, value }],
          },
        }),
      async () => {
        await deviceStore.fetchDevice(deviceId);
      },
      () => {}
    );
    updating = false;
  }

  async function handleRangeChange(event: Event & { currentTarget: HTMLInputElement }, param: EffectParameter) {
    const value = Number(event.currentTarget.value);
    await updateParameter(param, value);
  }

  async function handleCheckboxChange(event: Event & { currentTarget: HTMLInputElement }, param: EffectParameter) {
    const value = event.currentTarget.checked;
    await updateParameter(param, value);
  }
</script>

{#if parameters && parameters.length > 0}
  <div class="parameters-section">
    <h4>Parameters</h4>
    {#each parameters as param}
      {#if param.type === ParameterType.RANGE}
        <div class="control-group" title={param.description}>
          <label for={param.id}>
            <strong>{param.name}:</strong>
            {param.value}{param.unit || ''}
          </label>
          <input
            id={param.id}
            type="range"
            min={param.min}
            max={param.max}
            value={param.value}
            onchange={(e) => handleRangeChange(e, param)}
            disabled={updating}
          />
        </div>
      {:else if param.type === ParameterType.BOOLEAN}
        <div class="control-group checkbox-group" title={param.description}>
          <label for={param.id}>
            <input
              id={param.id}
              type="checkbox"
              checked={param.value}
              onchange={(e) => handleCheckboxChange(e, param)}
              disabled={updating}
            />
            <strong>{param.name}</strong>
          </label>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .parameters-section {
    border-top: 1px solid #eee;
    padding-top: 0.25rem;
    margin-top: 0.25rem;
  }

  h4 {
    color: #ff3e00;
    font-size: 1.1rem;
    margin: 1.5rem 0 1rem 0;
  }

  .control-group {
    margin-bottom: 1.5rem;
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
  }

  input[type='range']:disabled {
    opacity: 0.5;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  input[type='checkbox']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
