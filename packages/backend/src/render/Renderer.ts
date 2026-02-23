import type { FrameOutputStream } from './FrameOutputStream';
import {
  AnimationMode,
  type EffectContextStatic,
  type EffectContextLoop,
  type EffectContextSequence,
  type EffectLoop,
} from '../effects/Effect';
import type { RenderContext } from './RenderContext';

const YIELD_FRAME_COUNT = 50;

/** Default recording duration for Sequence effects in renderAsap. */
const DEFAULT_SEQUENCE_DURATION_MS = 30_000;

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
    const logic = effect.createLogic();

    // Reset phase for non-loop effects
    output.setPhase?.(null);

    switch (effect.animationMode) {
      case AnimationMode.Static: {
        // Static effects have no phase/time — re-render each frame so parameter changes take effect
        while (true) {
          signal.throwIfAborted();
          const ctx: EffectContextStatic = { total_leds: numberOfLeds, led_type: ledProfile };
          const points = await renderCtx.getPoints();
          const ledValues = logic.renderGlobal(ctx as any, points);
          await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
          await sleep(renderCtx.getMinFrameTimeMs());
        }
        break;
      }

      case AnimationMode.Loop: {
        const loopEffect = effect as EffectLoop<any>;
        const loopDurationMs = loopEffect.getLoopDurationSeconds(numberOfLeds) * 1000;
        if (loopDurationMs <= 0) {
          throw new Error(`Loop effect ${effect.getName()} has invalid loop duration`);
        }
        const firstStartTime = performance.now();
        let lastTime = firstStartTime;
        while (true) {
          signal.throwIfAborted();
          const frameStartTime = performance.now();
          const speed = renderCtx.getCurrentSpeedMultiplier();
          const elapsedTime = (frameStartTime - firstStartTime) * speed;
          const phase = (elapsedTime % loopDurationMs) / loopDurationMs;
          const ctx: EffectContextLoop = {
            total_leds: numberOfLeds,
            led_type: ledProfile,
            phase,
          };
          const points = await renderCtx.getPoints();
          const ledValues = logic.renderGlobal(ctx as any, points);
          output.setPhase?.(phase);
          await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
          const processingTime = performance.now() - frameStartTime;
          const timeToWait = renderCtx.getMinFrameTimeMs() - processingTime;
          if (timeToWait > 0) {
            await sleep(timeToWait);
          } else {
            await yieldNow();
          }
          lastTime = frameStartTime;
        }
        break;
      }

      case AnimationMode.Sequence: {
        const firstStartTime = performance.now();
        let lastTime = firstStartTime;
        while (true) {
          signal.throwIfAborted();
          const frameStartTime = performance.now();
          const speed = renderCtx.getCurrentSpeedMultiplier();
          const deltaTimeMs = (frameStartTime - lastTime) * speed;
          const elapsedTime = (frameStartTime - firstStartTime) * speed;
          const ctx: EffectContextSequence = {
            total_leds: numberOfLeds,
            led_type: ledProfile,
            total_time_ms: null, // Live rendering runs indefinitely
            time_ms: elapsedTime,
            delta_time_ms: deltaTimeMs,
          };
          const points = await renderCtx.getPoints();
          const ledValues = logic.renderGlobal(ctx as any, points);
          await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
          const processingTime = performance.now() - frameStartTime;
          const timeToWait = renderCtx.getMinFrameTimeMs() - processingTime;
          if (timeToWait > 0) {
            await sleep(timeToWait);
          } else {
            await yieldNow();
          }
          lastTime = frameStartTime;
        }
        break;
      }
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
    const logic = effect.createLogic();
    const frameTimeMs = renderCtx.getMinFrameTimeMs() * renderCtx.getCurrentSpeedMultiplier();

    switch (effect.animationMode) {
      case AnimationMode.Static: {
        // Single frame — no animation
        signal.throwIfAborted();
        const ctx: EffectContextStatic = { total_leds: numberOfLeds, led_type: ledProfile };
        const ledValues = logic.renderGlobal(ctx as any, points);
        await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
        break;
      }

      case AnimationMode.Loop: {
        // Render exactly one loop — no warmup needed
        const loopEffect = effect as EffectLoop<any>;
        const loopDurationMs = loopEffect.getLoopDurationSeconds(numberOfLeds) * 1000;
        if (loopDurationMs <= 0) {
          throw new Error(`Loop effect ${effect.getName()} has invalid loop duration`);
        }
        let virtualTime = 0;
        let frameIndex = 0;
        while (virtualTime < loopDurationMs) {
          signal.throwIfAborted();
          const ctx: EffectContextLoop = {
            total_leds: numberOfLeds,
            led_type: ledProfile,
            phase: virtualTime / loopDurationMs,
          };
          const ledValues = logic.renderGlobal(ctx as any, points);
          await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
          if (frameIndex % YIELD_FRAME_COUNT === 0) {
            await yieldNow();
          }
          virtualTime += frameTimeMs;
          frameIndex++;
        }
        break;
      }

      case AnimationMode.Sequence: {
        // Render a fixed duration (30s by default)
        const totalDurationMs = DEFAULT_SEQUENCE_DURATION_MS;
        let virtualTime = 0;
        let frameIndex = 0;
        while (virtualTime < totalDurationMs) {
          signal.throwIfAborted();
          const ctx: EffectContextSequence = {
            total_leds: numberOfLeds,
            led_type: ledProfile,
            total_time_ms: totalDurationMs,
            time_ms: virtualTime,
            delta_time_ms: frameTimeMs,
          };
          const ledValues = logic.renderGlobal(ctx as any, points);
          await output.writeFrame(renderCtx.floatTo8bitColor(ledValues));
          if (frameIndex % YIELD_FRAME_COUNT === 0) {
            await yieldNow();
          }
          virtualTime += frameTimeMs;
          frameIndex++;
        }
        break;
      }
    }
  }
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function yieldNow() {
  await new Promise((resolve) => setImmediate(resolve));
}
