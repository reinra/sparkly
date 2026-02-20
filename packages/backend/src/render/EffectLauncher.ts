import type { Device } from '../deviceList';
import {
  MultipleFrameOutputStream,
  BufferReplacingFrameOutputStream,
  MappedFrameOutputStream,
  ApiClientFrameOutputStream,
  MovieBufferOutputStream,
  type FrameFormat,
} from './FrameOutputStream';
import { EffectRenderer } from './Renderer';
import { logger } from '../logger';
import { DeviceModeSchema } from '../deviceClient/apiContract';
import type { RenderContext } from './RenderContext';

const renderer = new EffectRenderer();

async function buildFrameFormat(renderCtx: RenderContext): Promise<FrameFormat> {
  return {
    led_type: await renderCtx.getLedProfile(),
    led_count: await renderCtx.getNumberOfLeds(),
  };
}

export async function startEffect(device: Device, renderCtx: RenderContext, signal: AbortSignal) {
  const basicLedMapper = await renderCtx.getLedMapper(false);
  const fixedLedMapper = await renderCtx.getLedMapper(true);
  const frameFormat = await buildFrameFormat(renderCtx);
  const output = new MultipleFrameOutputStream([
    new MappedFrameOutputStream(new BufferReplacingFrameOutputStream(device.buffer), basicLedMapper),
    new MappedFrameOutputStream(
      new ApiClientFrameOutputStream(device.api_client, frameFormat),
      fixedLedMapper
    ),
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

async function prepareForSendingLedValues(device: Device) {
  await device.api_client.setMode(DeviceModeSchema.Values.rt);
}

export async function sendEffectAsMovie(device: Device, renderCtx: RenderContext, signal: AbortSignal) {
  const ledMapper = await renderCtx.getLedMapper(true);
  const frameFormat = await buildFrameFormat(renderCtx);
  const movieBuffer = new MovieBufferOutputStream(frameFormat);
  const output = new MappedFrameOutputStream(movieBuffer, ledMapper);

  await prepareForSendingLedValues(device);

  const renderStart = Date.now();
  await renderer.renderAsap(renderCtx, output, signal);
  const renderDuration = Date.now() - renderStart;
  logger.debug(`renderAsap completed in ${renderDuration}ms with ${movieBuffer.getFrameCount()} frames`);

  const postStart = Date.now();
  const movieResult = await device.api_client.postMovieFull(movieBuffer.getMovieBuffer());
  const postDuration = Date.now() - postStart;
  logger.debug(`postMovieFull completed in ${postDuration}ms with frames_number=${movieResult.frames_number}`);

  const frameMs = renderCtx.getMinFrameTimeMs();
  await device.api_client.setLedMovieConfig({
    frame_delay: frameMs,
    leds_number: frameFormat.led_count,
    frames_number: movieBuffer.getFrameCount(),
  });

  await device.api_client.setMode(DeviceModeSchema.Values.movie);
}
