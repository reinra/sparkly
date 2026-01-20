import { TwinklyApiClient } from '../apiClient';
import type { LedValue } from './Color';
import type { FrameOutputStream } from './FrameOutputStream';
import type { SameColorEffect } from './SameColorEffect';
import type { StaticStripEffect } from './StaticStripEffect';
import type { StripEffect } from './StripEffect';

export interface Renderer<T> {
  render(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): void;
}

export type AnyEffect = SameColorEffect | StaticStripEffect | StripEffect;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
  private readonly sameColorEffectRenderer = new SameColorEffectRenderer();
  private readonly staticStripEffectRenderer = new StaticStripEffectRenderer();
  private readonly stripEffectRenderer = new StripEffectRenderer();
  async render(effect: AnyEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    if ('getColors' in effect) {
      await this.sameColorEffectRenderer.render(effect, apiClient, output, signal);
    } else if ('getFrame' in effect) {
      await this.staticStripEffectRenderer.render(effect, apiClient, output, signal);
    } else if ('getFrames' in effect) {
      await this.stripEffectRenderer.render(effect, apiClient, output, signal);
    } else {
      throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
    }
  }
}

export class SameColorEffectRenderer implements Renderer<SameColorEffect> {
  async render(effect: SameColorEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const colors = effect.getColors();
    for (const color of colors) {
      signal.throwIfAborted();
      const frame: LedValue[] = new Array(numberOfLeds).fill(color);
      await output.writeFrame(frame);
      await sleep(10);
    }
  }
}

export class StaticStripEffectRenderer implements Renderer<StaticStripEffect> {
  async render(effect: StaticStripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frame = effect.getFrame({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    await output.writeFrame(frame);
  }
}

export class StripEffectRenderer implements Renderer<StripEffect> {
  async render(effect: StripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frames = effect.getFrames({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    for (const frame of frames) {
      signal.throwIfAborted();
      await output.writeFrame(frame);
      await sleep(10);
    }
  }
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
