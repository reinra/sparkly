import { TwinklyApiClient, type GestaltResponseType } from '../deviceClient/apiClient';
import type { LedValue } from '../color/Color';
import type { FrameOutputStream } from './FrameOutputStream';
import type { SameColorEffect } from '../effects/old/SameColorEffect';
import type { StaticStripEffect } from '../effects/old/StaticStripEffect';
import type { StripEffect } from '../effects/old/StripEffect';
import type { Effect, EffectContext, LedPoint1D } from '../effects/generic/Effect';

export interface Renderer<T> {
  render(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): void;
}

export type AnyEffect = SameColorEffect | StaticStripEffect | StripEffect | Effect<any>;

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
    } else if ('pointType' in effect) {
      const pointType = effect.pointType;
      if (pointType !== '1D') {
        throw new Error(`Unsupported effect point type: ${pointType}`);
      }
      const effect1D = effect as Effect<LedPoint1D>;
      const effect1DRenderer = new Effect1DRenderer();
      await effect1DRenderer.render(effect1D, apiClient, output, signal);
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

export class Effect1DRenderer implements Renderer<Effect<LedPoint1D>> {
  async render(effect: Effect<LedPoint1D>, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void> {
    const gestalt = await apiClient.gestalt();
    const points = getPoints(gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = effect.getLoopDurationSeconds(numberOfLeds) * 1000;
    const minFrameMs = 1000 / gestalt.frame_rate;

    const firstStartTime = performance.now();
    let lastTime = firstStartTime;
    let frameIndex = 0;
    while (true) {
      signal.throwIfAborted();

      const frameStartTime = performance.now();
      const deltaTimeMs = frameStartTime - lastTime;
      const elapsedTime = frameStartTime - firstStartTime;

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: gestalt.led_profile,
        speed: 1.0,
        time_ms: elapsedTime,
        delta_time_ms: deltaTimeMs,
        frame_index: frameIndex,
        phase: (elapsedTime % loopDurationMs) / loopDurationMs,
      };
      const ledValues = effect.renderGlobal(ctx, points);
      await output.writeFrame(ledValues);

      const processingTime = performance.now() - frameStartTime;
      const timeToWait = minFrameMs - processingTime;
      if (timeToWait > 0) {
        await sleep(timeToWait);
      }
      else {
        await yieldNow();
      }

      frameIndex++;
      lastTime = frameStartTime;
    }
  }
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function yieldNow() {
  await new Promise(resolve => setImmediate(resolve));  
}

function getPoints(gestalt: GestaltResponseType): LedPoint1D[] {
  const points: LedPoint1D[] = [];
  for (let i = 0; i < gestalt.number_of_led; i++) {
    points.push({ id: i, position: i, distance: i / gestalt.number_of_led });
  }
  return points;
}
