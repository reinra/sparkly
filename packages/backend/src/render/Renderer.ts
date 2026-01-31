import { TwinklyApiClient, type GestaltResponseType } from '../deviceClient/apiClient';
import type { LedValue } from '../color/Color';
import type { FrameOutputStream } from './FrameOutputStream';
import type { SameColorEffect } from '../effects/old/SameColorEffect';
import type { StaticStripEffect } from '../effects/old/StaticStripEffect';
import type { StripEffect } from '../effects/old/StripEffect';
import { is1DEffect, type Effect, type EffectContext, type LedPoint1D } from '../effects/generic/Effect';

const CUTOFF_FRAME_COUNT = 1000;
const YIELD_FRAME_COUNT = 50;

export interface Renderer<T> {
  renderLive(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
  renderAsap(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
}

export type AnyEffect = SameColorEffect | StaticStripEffect | StripEffect | Effect<any>;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
  private readonly sameColorEffectRenderer = new SameColorEffectRenderer();
  private readonly staticStripEffectRenderer = new StaticStripEffectRenderer();
  private readonly stripEffectRenderer = new StripEffectRenderer();
  private readonly effect1DRenderer = new Effect1DRenderer();
  async renderLive(effect: AnyEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    await (this.getRenderer(effect)).renderLive(effect, apiClient, output, signal);
  }
  async renderAsap(effect: AnyEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    await (this.getRenderer(effect)).renderAsap(effect, apiClient, output, signal);
  }
  private getRenderer(effect: AnyEffect): Renderer<AnyEffect> {
    if (isNewEffect(effect) && is1DEffect(effect)) {
      return this.effect1DRenderer;
    }
    if (isSameColorEffect(effect)) {
      return this.sameColorEffectRenderer;
    }
    if (isStaticStripEffect(effect)) {
      return this.staticStripEffectRenderer;
    } 
    if (isStripEffect(effect)) {
      return this.stripEffectRenderer;
    } 
    throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
  }
} 

function isSameColorEffect(effect: AnyEffect): effect is SameColorEffect {
  return 'getColors' in effect;
}
function isStaticStripEffect(effect: AnyEffect): effect is StaticStripEffect {
  return 'getFrame' in effect;
}
function isStripEffect(effect: AnyEffect): effect is StripEffect {
  return 'getFrames' in effect;
}
function isNewEffect(effect: AnyEffect): effect is Effect<any> {
  return 'renderGlobal' in effect;
}

export class SameColorEffectRenderer implements Renderer<SameColorEffect> {
  async renderLive(effect: SameColorEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
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
  async renderAsap(effect: SameColorEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const colors = effect.getColors();
    let frameCount = 0;
    for (const color of colors) {
      signal.throwIfAborted();
      const frame: LedValue[] = new Array(numberOfLeds).fill(color);
      await output.writeFrame(frame);
      frameCount++;
      if (frameCount >= CUTOFF_FRAME_COUNT) {
        break;
      }
    }
  }
}

export class StaticStripEffectRenderer implements Renderer<StaticStripEffect> {
  async renderLive(effect: StaticStripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frame = effect.getFrame({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    await output.writeFrame(frame);
  }
  async renderAsap(effect: StaticStripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    return this.renderLive(effect, apiClient, output, signal);
  }
}

export class StripEffectRenderer implements Renderer<StripEffect> {
  async renderLive(effect: StripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frames = effect.getFrames({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    for (const frame of frames) {
      signal.throwIfAborted();
      await output.writeFrame(frame);
      await sleep(10);
    }
  }
  async renderAsap(effect: StripEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frames = effect.getFrames({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    let frameCount = 0;
    for (const frame of frames) {
      signal.throwIfAborted();
      await output.writeFrame(frame);
      await sleep(10);
      frameCount++;
      if (frameCount >= CUTOFF_FRAME_COUNT) {
        break;
      }
    }
  }
}

export class Effect1DRenderer implements Renderer<Effect<LedPoint1D>> {
  async renderLive(effect: Effect<LedPoint1D>, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void> {
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
  async renderAsap(effect: Effect<LedPoint1D>, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void> {
    const gestalt = await apiClient.gestalt();
    const points = getPoints(gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = effect.getLoopDurationSeconds(numberOfLeds) * 1000;
    const [startRecordingMs, endRecordingMs] = effect.isStateful ? [loopDurationMs, loopDurationMs * 2] : [0, loopDurationMs];
    const frameTimeMs = 1000 / gestalt.frame_rate; // Fixed time between frames

    let virtualTime = 0;
    let frameIndex = 0;
    
    while (virtualTime < endRecordingMs) {
      signal.throwIfAborted();

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: gestalt.led_profile,
        speed: 1.0,
        time_ms: virtualTime,
        delta_time_ms: frameTimeMs,
        frame_index: frameIndex,
        phase: (virtualTime % loopDurationMs) / loopDurationMs,
      };
      const ledValues = effect.renderGlobal(ctx, points);
      if (virtualTime >= startRecordingMs) {
        await output.writeFrame(ledValues);
      }
      if (frameIndex % YIELD_FRAME_COUNT === 0) {
        await yieldNow();
      }

      virtualTime += frameTimeMs;
      frameIndex++;
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
