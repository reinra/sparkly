import type { GestaltResponseType } from '../deviceClient/apiClient';
import type { FrameOutputStream } from './FrameOutputStream';
import { LedPoint2D, type Effect, type EffectContext, type LedPoint1D } from '../effects/generic/Effect';
import type { DeviceHelper } from '../DeviceHelper';

const YIELD_FRAME_COUNT = 50;

export interface Renderer<T> {
  renderLive(effect: T, deviceHelper: DeviceHelper, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
  renderAsap(effect: T, deviceHelper: DeviceHelper, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
}

export type AnyEffect = Effect<any>;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
  private readonly newEffectRenderer = new NewEffectRenderer();
  async renderLive(effect: AnyEffect, deviceHelper: DeviceHelper, output: FrameOutputStream, signal: AbortSignal) {
    await this.getRenderer(effect).renderLive(effect, deviceHelper, output, signal);
  }
  async renderAsap(effect: AnyEffect, deviceHelper: DeviceHelper, output: FrameOutputStream, signal: AbortSignal) {
    await this.getRenderer(effect).renderAsap(effect, deviceHelper, output, signal);
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
  async renderLive(
    effect: Effect<any>,
    deviceHelper: DeviceHelper,
    output: FrameOutputStream,
    signal: AbortSignal
  ): Promise<void> {
    const gestalt = await deviceHelper.getGestalt();
    const points = await getPoints(effect, deviceHelper, gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
    const minFrameMs = 1000 / gestalt.frame_rate;

    const firstStartTime = performance.now();
    let lastTime = firstStartTime;
    let frameIndex = 0;
    while (true) {
      signal.throwIfAborted();

      const frameStartTime = performance.now();
      const speed = deviceHelper.getCurrentSpeedMultiplier();
      const deltaTimeMs = (frameStartTime - lastTime) * speed;
      const elapsedTime = (frameStartTime - firstStartTime) * speed;

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: gestalt.led_profile,
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
      } else {
        await yieldNow();
      }

      frameIndex++;
      lastTime = frameStartTime;
    }
  }
  async renderAsap(
    effect: Effect<any>,
    deviceHelper: DeviceHelper,
    output: FrameOutputStream,
    signal: AbortSignal
  ): Promise<void> {
    const gestalt = await deviceHelper.getGestalt();
    const points = await getPoints(effect, deviceHelper, gestalt);
    const numberOfLeds = gestalt.number_of_led;
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
    const [startRecordingMs, endRecordingMs] = effect.isStateful
      ? [loopDurationMs, loopDurationMs * 2]
      : [0, loopDurationMs];
    const frameTimeMs = 1000 / gestalt.frame_rate; // Fixed time between frames

    let virtualTime = 0;
    let frameIndex = 0;

    // For static effects, just render one frame
    while (virtualTime < endRecordingMs || virtualTime === 0) {
      signal.throwIfAborted();

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: gestalt.led_profile,
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
    throw new Error(
      `Effect ${effect.getName()} does not support renderAsap() because it is stateful but has zero loop duration`
    );
  }
  return loopDurationMs;
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function yieldNow() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function getPoints(
  effect: Effect<any>,
  deviceHelper: DeviceHelper,
  gestalt: GestaltResponseType
): Promise<LedPoint1D[] | LedPoint2D[]> {
  if (effect.pointType === '1D') {
    return getPoints1D(gestalt);
  }
  if (effect.pointType === '2D') {
    return (await deviceHelper.getLedMapping()).coordinates;
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
