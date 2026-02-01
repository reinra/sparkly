import { TwinklyApiClient, type GestaltResponseType } from '../deviceClient/apiClient';
import type { FrameOutputStream } from './FrameOutputStream';
import { LedPoint2D, type Effect, type EffectContext, type LedPoint1D } from '../effects/generic/Effect';

const YIELD_FRAME_COUNT = 50;

export interface Renderer<T> {
  renderLive(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
  renderAsap(effect: T, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
}

export type AnyEffect = Effect<any>;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
  private readonly newEffectRenderer = new NewEffectRenderer();
  async renderLive(effect: AnyEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    await (this.getRenderer(effect)).renderLive(effect, apiClient, output, signal);
  }
  async renderAsap(effect: AnyEffect, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal) {
    await (this.getRenderer(effect)).renderAsap(effect, apiClient, output, signal);
  }
  private getRenderer(effect: AnyEffect): Renderer<AnyEffect> {
    if (isNewEffect(effect)) {
      return this.newEffectRenderer;
    }
    throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
  }
} 

function isNewEffect(effect: AnyEffect): effect is Effect<any> {
  return 'renderGlobal' in effect;
}

export class NewEffectRenderer implements Renderer<Effect<any>> {
  async renderLive(effect: Effect<any>, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void> {
    const gestalt = await apiClient.gestalt();
    const points = await getPoints(effect, apiClient, gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
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
  async renderAsap(effect: Effect<any>, apiClient: TwinklyApiClient, output: FrameOutputStream, signal: AbortSignal): Promise<void> {
    const gestalt = await apiClient.gestalt();
    const points = await getPoints(effect, apiClient, gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
    const [startRecordingMs, endRecordingMs] = effect.isStateful ? [loopDurationMs, loopDurationMs * 2] : [0, loopDurationMs];
    const frameTimeMs = 1000 / gestalt.frame_rate; // Fixed time between frames

    let virtualTime = 0;
    let frameIndex = 0;
    
    // For static effects, just render one frame
    while (virtualTime < endRecordingMs || virtualTime === 0) {
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

function getValidLoopDurationInMs(effect: Effect<any>, numberOfLeds: number) {
  const loopDurationMs = effect.getLoopDurationSeconds(numberOfLeds) * 1000;
  if (loopDurationMs < 0) {
    throw new Error(`Effect ${effect.getName()} does not support renderAsap() because it has no defined loop duration`);
  }
  if (loopDurationMs === 0 && effect.isStateful) {
    throw new Error(`Effect ${effect.getName()} does not support renderAsap() because it is stateful but has zero loop duration`);
  }
  return loopDurationMs;
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function yieldNow() {
  await new Promise(resolve => setImmediate(resolve));  
}

async function getPoints(effect: Effect<any>, apiClient: TwinklyApiClient, gestalt: GestaltResponseType): Promise<LedPoint1D[] | LedPoint2D[]> {
  if (effect.pointType === '1D') {
    return getPoints1D(gestalt);
  }
  if (effect.pointType === '2D') {
    return await getPoints2D(apiClient, gestalt);
  }
  throw new Error(`Unsupported effect point type: ${effect.pointType}`);
}

function getPoints1D(gestalt: GestaltResponseType): LedPoint1D[] {
  const points: LedPoint1D[] = [];
  for (let i = 0; i < gestalt.number_of_led; i++) {
    points.push({ id: i, position: i, distance: i / gestalt.number_of_led });
  }
  return points;
}

async function getPoints2D(apiClient: TwinklyApiClient, gestalt: GestaltResponseType): Promise<LedPoint2D[]> {
  const layout = await apiClient.getLayout();
  
  // Find min/max for normalization
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const led of layout.coordinates) {
    minX = Math.min(minX, led.x);
    maxX = Math.max(maxX, led.x);
    minY = Math.min(minY, led.y);
    maxY = Math.max(maxY, led.y);
  }
  
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  
  // Normalize coordinates to 0...1
  const points: LedPoint2D[] = [];
  let i = 0;
  for (const led of layout.coordinates) {
    const normalizedX = rangeX > 0 ? (led.x - minX) / rangeX : 0;
    const normalizedY = rangeY > 0 ? (led.y - minY) / rangeY : 0;
    points.push({ id: i, x: normalizedX, y: normalizedY });
    i++;
  }
  
  return points;
}
