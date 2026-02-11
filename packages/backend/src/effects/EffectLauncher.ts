import type { Device } from '../deviceList';
import {
  MultipleFrameOutputStream,
  BufferReplacingFrameOutputStream,
  MappedFrameOutputStream,
  ApiClientFrameOutputStream,
  MovieBufferOutputStream,
} from '../render/FrameOutputStream';
import { EffectRenderer } from '../render/Renderer';
import { logger } from '../logger';
import type { GestaltResponseType } from '../deviceClient/apiClient';
import { Effect } from './Effect';
import { DeviceModeSchema } from '../deviceClient/apiContract';

const renderer = new EffectRenderer();

export async function startEffect(device: Device, effect: Effect<any>, signal: AbortSignal) {
  const basicLedMapper = await device.helper.getLedMapper(false);
  const fixedLedMapper = await device.helper.getLedMapper(true);
  const gestalt = await device.helper.getGestalt();
  const output = new MultipleFrameOutputStream([
    new MappedFrameOutputStream(new BufferReplacingFrameOutputStream(device.buffer), basicLedMapper),
    new MappedFrameOutputStream(
      new ApiClientFrameOutputStream(device.api_client, toFrameFormat(gestalt)),
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
    await renderer.renderLive(effect, device.helper, output, signal);
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

export async function sendEffectAsMovie(device: Device, effect: Effect<any>, signal: AbortSignal) {
  const ledMapper = await device.helper.getLedMapper(true);
  const gestalt = await device.helper.getGestalt();
  const movieBuffer = new MovieBufferOutputStream(toFrameFormat(gestalt));
  const output = new MappedFrameOutputStream(movieBuffer, ledMapper);

  await prepareForSendingLedValues(device);

  const renderStart = Date.now();
  await renderer.renderAsap(effect, device.helper, output, signal);
  const renderDuration = Date.now() - renderStart;
  logger.debug(`renderAsap completed in ${renderDuration}ms with ${movieBuffer.getFrameCount()} frames`);

  const postStart = Date.now();
  const movieResult = await device.api_client.postMovieFull(movieBuffer.getMovieBuffer());
  const postDuration = Date.now() - postStart;
  logger.debug(`postMovieFull completed in ${postDuration}ms with frames_number=${movieResult.frames_number}`);

  const frameMs = device.helper.getMinFrameTimeMs();
  await device.api_client.setLedMovieConfig({
    frame_delay: frameMs,
    leds_number: gestalt.number_of_led,
    frames_number: movieBuffer.getFrameCount(),
  });

  await device.api_client.setMode(DeviceModeSchema.Values.movie);
}

function toFrameFormat(gestalt: GestaltResponseType) {
  return {
    led_type: gestalt.led_profile,
    led_count: gestalt.number_of_led,
  };
}
