import { Mode } from "../deviceClient/apiContract";
import type { Device } from "../deviceList";
import { MultipleFrameOutputStream, BufferReplacingFrameOutputStream, MappedFrameOutputStream, ApiClientFrameOutputStream, MovieBufferOutputStream } from "../render/FrameOutputStream";
import { IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper, type LedMapper } from "../render/LedMapper";
import { AnyEffectRenderer, type AnyEffect } from "../render/Renderer";
import { logger } from "../logger";
import type { GestaltResponseType } from "../deviceClient/apiClient";

const renderer = new AnyEffectRenderer();

export async function startEffect(device: Device, effect: AnyEffect, signal: AbortSignal) {
  const ledMapper = await prepareLedMapping(device);
  const gestalt = await device.api_client.gestalt();
  const output = new MultipleFrameOutputStream([
    new BufferReplacingFrameOutputStream(device.buffer),
    new MappedFrameOutputStream(
      new ApiClientFrameOutputStream(device.api_client, toFrameFormat(gestalt)),
      ledMapper
    )]);
  effect = cloneEffectIfNeeded(effect);
  await prepareForSendingLedValues(device);
  
  // Schedule regular keep-alive calls every 5 minutes
  let keepAliveInterval: NodeJS.Timeout | null = setInterval(() => {
    prepareForSendingLedValues(device).catch(err => {
      logger.error("Keep-alive call failed:", err);
    });
  }, 5 * 60 * 1000); // 5 minutes
  
  // Clear interval on abort signal - using unique handler per invocation
  const abortHandler = () => {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };
  signal.addEventListener('abort', abortHandler);
  
  try {
    await renderer.renderLive(effect, device.api_client, output, signal);
  } finally {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    signal.removeEventListener('abort', abortHandler);
  }
}

async function prepareForSendingLedValues(device: Device) {
    await device.api_client.setMode(Mode.rt);
}

export async function sendEffectAsMovie(device: Device, effect: AnyEffect, signal: AbortSignal) {
  const ledMapper = await prepareLedMapping(device);
  const gestalt = await device.api_client.gestalt();
  const movieBuffer = new MovieBufferOutputStream(toFrameFormat(gestalt));
  const output = new MappedFrameOutputStream(movieBuffer, ledMapper);
  effect = cloneEffectIfNeeded(effect);
  
  await prepareForSendingLedValues(device);
    
  await renderer.renderAsap(effect, device.api_client, output, signal);
  await device.api_client.postMovieFull(movieBuffer.getMovieBuffer());
  await device.api_client.setMode(Mode.movie);
}

async function prepareLedMapping(device: Device) {
  const ledConfig = await device.api_client.getLedConfig();

  let mapper: LedMapper = new IdentityLedMapper();
  if (ledConfig.strings.length === 2) {
    const halfLength = ledConfig.strings[0].length;
    mapper = new SegmentedLedMapper([
      { startIndex: 0, mapper: new ReverseLedMapper(halfLength) },
      { startIndex: halfLength, mapper: new IdentityLedMapper() },
    ]);
  }
  return mapper;
}

function cloneEffectIfNeeded(effect: AnyEffect) {
    if ('isStateful' in effect && effect.isStateful) {
        return cloneEffect(effect);
    }
    return effect;
}

function cloneEffect(effect: AnyEffect) {
    const effectConstructor = effect.constructor as new (...args: any[]) => AnyEffect;
    effect = new effectConstructor(...Object.values(effect));
    return effect;
}

function toFrameFormat(gestalt: GestaltResponseType) {
    return {
        led_type: gestalt.led_profile,
        led_count: gestalt.number_of_led,
    };
}
