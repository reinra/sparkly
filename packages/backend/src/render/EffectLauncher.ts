import type { DeviceHelper } from '../DeviceHelper';
import {
  MultipleFrameOutputStream,
  BufferReplacingFrameOutputStream,
  MappedFrameOutputStream,
  ApiClientFrameOutputStream,
  MovieBufferOutputStream,
  ProgressTrackingFrameOutputStream,
  type FrameFormat,
} from './FrameOutputStream';
import { EffectRenderer } from './Renderer';
import { logger } from '../logger';
import { DeviceModeSchema } from '../deviceClient/ApiContract';
import { AnimationMode, type EffectLoop, type EffectSequence } from '../effects/Effect';
import type { RenderContext } from './RenderContext';

const renderer = new EffectRenderer();

/** Default recording duration for Sequence effects — must match Renderer constant. */
const DEFAULT_SEQUENCE_DURATION_MS = 30_000;

/** Callback interface for reporting movie-send progress. */
export interface MovieProgressCallback {
  /** Called once, before rendering starts. totalFrames and effectDurationMs may be null if unknown (estimates). */
  onRenderStart(totalFrames: number | null, effectDurationMs: number | null): void;
  /** Called after each frame is rendered. */
  onFrameRendered(frameIndex: number, totalFrames: number | null): void;
  /** Called when rendering is done, about to upload. */
  onUploadStart(frameCount: number, uploadBytesTotal: number, effectDurationMs: number): void;
  /** Called periodically during upload with bytes sent so far. */
  onUploadProgress(bytesSent: number, bytesTotal: number): void;
  /** Called when upload is done, configuring device. */
  onConfiguring(): void;
  /** Called when everything is done. */
  onComplete(frameCount: number, effectDurationMs: number): void;
  /** Called on error. */
  onError(error: string): void;
}

async function buildFrameFormat(renderCtx: RenderContext): Promise<FrameFormat> {
  return {
    led_type: await renderCtx.getLedProfile(),
    led_count: await renderCtx.getNumberOfLeds(),
  };
}

export async function startEffect(device: DeviceHelper, renderCtx: RenderContext, signal: AbortSignal) {
  const basicLedMapper = await renderCtx.getLedMapper(false);
  const fixedLedMapper = await renderCtx.getLedMapper(true);
  const frameFormat = await buildFrameFormat(renderCtx);
  const output = new MultipleFrameOutputStream([
    new MappedFrameOutputStream(new BufferReplacingFrameOutputStream(device.buffer), basicLedMapper),
    new MappedFrameOutputStream(new ApiClientFrameOutputStream(device.apiClient, frameFormat), fixedLedMapper),
  ]);
  await prepareForSendingLedValues(device);

  // Schedule regular keep-alive calls every 5 minutes
  let keepAliveInterval: NodeJS.Timeout | null = setInterval(
    () => {
      prepareForSendingLedValues(device).catch((err) => {
        logger.error('Keep-alive call failed:', err);
      });
    },
    5 * 60 * 1000
  ); // 5 minutes

  // Clear interval on abort signal - using unique handler per invocation
  const abortHandler = () => {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };
  signal.addEventListener('abort', abortHandler);

  try {
    await renderer.renderLive(renderCtx, output, signal);
  } finally {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    signal.removeEventListener('abort', abortHandler);
  }
}

async function prepareForSendingLedValues(device: DeviceHelper) {
  await device.setMode(DeviceModeSchema.Values.rt);
}

export async function sendEffectAsMovie(
  device: DeviceHelper,
  renderCtx: RenderContext,
  signal: AbortSignal,
  progressCb?: MovieProgressCallback
) {
  const ledMapper = await renderCtx.getLedMapper(true);
  const frameFormat = await buildFrameFormat(renderCtx);
  const movieBuffer = new MovieBufferOutputStream(frameFormat);

  // Estimate total frame count and duration before rendering
  const loopCycles = renderCtx.getLoopCycles();
  const totalFrames = estimateTotalFrames(renderCtx, frameFormat.led_count, loopCycles);
  const estimatedDurationMs = estimateEffectDurationMs(renderCtx, frameFormat.led_count);
  progressCb?.onRenderStart(totalFrames, estimatedDurationMs);

  // Wrap output to track frame-by-frame progress
  const progressOutput = new ProgressTrackingFrameOutputStream(movieBuffer, (frameIndex) => {
    progressCb?.onFrameRendered(frameIndex, totalFrames);
  });
  const output = new MappedFrameOutputStream(progressOutput, ledMapper);

  await prepareForSendingLedValues(device);

  const renderStart = Date.now();
  await renderer.renderAsap(renderCtx, output, signal);
  const renderDuration = Date.now() - renderStart;
  logger.debug(`renderAsap completed in ${renderDuration}ms with ${movieBuffer.getFrameCount()} frames`);

  const movieData = movieBuffer.getMovieBuffer();
  const frameMs = renderCtx.getMinFrameTimeMs();
  const effectDurationMs = Math.round(movieBuffer.getFrameCount() * frameMs);
  progressCb?.onUploadStart(movieBuffer.getFrameCount(), movieData.byteLength, effectDurationMs);

  const postStart = Date.now();
  const movieResult = await device.apiClient.postMovieFull(movieData, (bytesSent, bytesTotal) => {
    progressCb?.onUploadProgress(bytesSent, bytesTotal);
  });
  const postDuration = Date.now() - postStart;
  logger.debug(`postMovieFull completed in ${postDuration}ms with frames_number=${movieResult.frames_number}`);

  progressCb?.onConfiguring();

  await device.apiClient.setLedMovieConfig({
    frame_delay: frameMs,
    leds_number: frameFormat.led_count,
    frames_number: movieBuffer.getFrameCount(),
  });

  await device.setMode(DeviceModeSchema.Values.movie);
  progressCb?.onComplete(movieBuffer.getFrameCount(), effectDurationMs);
}

/**
 * Estimate the effect's own duration in milliseconds before rendering,
 * based on the effect's animation mode. Returns null if unknown.
 */
function estimateEffectDurationMs(renderCtx: RenderContext, ledCount: number): number | null {
  const effect = renderCtx.effect;
  const frameTimeMs = renderCtx.getMinFrameTimeMs() * renderCtx.getCurrentSpeedMultiplier();

  switch (effect.animationMode) {
    case AnimationMode.Static:
      return Math.round(frameTimeMs);
    case AnimationMode.Loop: {
      const loopEffect = effect as EffectLoop<any>;
      const loopDurationMs = loopEffect.getLoopDurationSeconds(ledCount) * 1000;
      const loopCycles = renderCtx.getLoopCycles();
      return loopDurationMs > 0 ? Math.round(loopDurationMs * loopCycles) : null;
    }
    case AnimationMode.Sequence: {
      const seqEffect = effect as EffectSequence<any>;
      if (seqEffect.hasCycleReset) return null; // Duration depends on randomness
      return DEFAULT_SEQUENCE_DURATION_MS;
    }
    default:
      return null;
  }
}

/**
 * Estimate the total number of frames that renderAsap will produce,
 * based on the effect's animation mode and timing parameters.
 */
function estimateTotalFrames(renderCtx: RenderContext, ledCount: number, loopCycles: number): number | null {
  const effect = renderCtx.effect;
  const frameTimeMs = renderCtx.getMinFrameTimeMs() * renderCtx.getCurrentSpeedMultiplier();

  switch (effect.animationMode) {
    case AnimationMode.Static:
      return 1;
    case AnimationMode.Loop: {
      const loopEffect = effect as EffectLoop<any>;
      const loopDurationMs = loopEffect.getLoopDurationSeconds(ledCount) * 1000;
      if (loopDurationMs <= 0) return null;
      return Math.ceil((loopDurationMs * loopCycles) / frameTimeMs);
    }
    case AnimationMode.Sequence: {
      const seqEffect = effect as EffectSequence<any>;
      if (seqEffect.hasCycleReset) return null; // Duration depends on randomness
      return Math.ceil(DEFAULT_SEQUENCE_DURATION_MS / frameTimeMs);
    }
    default:
      return null;
  }
}
