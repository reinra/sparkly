import type { FrameOutputStream } from './FrameOutputStream';
import type { EffectContext } from '../effects/Effect';
import { Effect } from '../effects/Effect';
import type { RenderContext } from './RenderContext';

const YIELD_FRAME_COUNT = 50;

export interface Renderer {
  renderLive(ctx: RenderContext, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
  renderAsap(ctx: RenderContext, output: FrameOutputStream, signal: AbortSignal): Promise<void>;
}

export class EffectRenderer implements Renderer {
  async renderLive(
    renderCtx: RenderContext,
    output: FrameOutputStream,
    signal: AbortSignal
  ): Promise<void> {
    const effect = renderCtx.effect;
    const numberOfLeds = await renderCtx.getNumberOfLeds();
    const ledProfile = await renderCtx.getLedProfile();
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
    const logic = effect.createLogic();

    const firstStartTime = performance.now();
    let lastTime = firstStartTime;
    let frameIndex = 0;
    while (true) {
      signal.throwIfAborted();

      const frameStartTime = performance.now();
      const speed = renderCtx.getCurrentSpeedMultiplier();
      const deltaTimeMs = (frameStartTime - lastTime) * speed;
      const elapsedTime = (frameStartTime - firstStartTime) * speed;

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: ledProfile,
        time_ms: elapsedTime,
        delta_time_ms: deltaTimeMs,
        frame_index: frameIndex,
        phase: (elapsedTime % loopDurationMs) / loopDurationMs,
      };
      const points = await renderCtx.getPoints();
      const ledValues = logic.renderGlobal(ctx, points);
      await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));

      const processingTime = performance.now() - frameStartTime;
      const timeToWait = renderCtx.getMinFrameTimeMs() - processingTime;
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
    renderCtx: RenderContext,
    output: FrameOutputStream,
    signal: AbortSignal
  ): Promise<void> {
    const effect = renderCtx.effect;
    const numberOfLeds = await renderCtx.getNumberOfLeds();
    const ledProfile = await renderCtx.getLedProfile();
    const points = await renderCtx.getPoints();
    const loopDurationMs = getValidLoopDurationInMs(effect, numberOfLeds);
    const [startRecordingMs, endRecordingMs] = effect.isStateful
      ? [loopDurationMs, loopDurationMs * 2]
      : [0, loopDurationMs];
    const frameTimeMs = renderCtx.getMinFrameTimeMs() * renderCtx.getCurrentSpeedMultiplier();
    const logic = effect.createLogic();

    let virtualTime = 0;
    let frameIndex = 0;

    // For static effects, just render one frame
    while (virtualTime < endRecordingMs || virtualTime === 0) {
      signal.throwIfAborted();

      const ctx: EffectContext = {
        total_leds: numberOfLeds,
        led_type: ledProfile,
        time_ms: virtualTime,
        delta_time_ms: frameTimeMs,
        frame_index: frameIndex,
        phase: (virtualTime % loopDurationMs) / loopDurationMs,
      };
      const ledValues = logic.renderGlobal(ctx, points);
      if (virtualTime >= startRecordingMs) {
        await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
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
