import { Mode } from "../../apiContract";
import type { Device } from "../deviceList";
import { MultipleFrameOutputStream, BufferReplacingFrameOutputStream, MappedFrameOutputStream, ApiClientFrameOutputStream } from "../render/FrameOutputStream";
import { IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper, type LedMapper } from "../render/LedMapper";
import { AnyEffectRenderer, type AnyEffect } from "../render/Renderer";
import { logger } from "../logger";

const renderer = new AnyEffectRenderer();

export async function startEffect(device: Device, effect: AnyEffect, signal: AbortSignal) {
  const ledMapper = await prepareLedMapping(device);
  const getstalt = await device.api_client.gestalt();
  const output = new MultipleFrameOutputStream([
    new BufferReplacingFrameOutputStream(device.buffer),
    new MappedFrameOutputStream(
      new ApiClientFrameOutputStream(device.api_client, {
        led_type: getstalt.led_profile,
        led_count: getstalt.number_of_led,
      }),
      ledMapper
    )]);
  if ("isStateful" in effect && effect.isStateful) {
    // If the effect is stateful, we should not share it between multiple devices
    effect = cloneEffect(effect);
  }
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
    await renderer.render(effect, device.api_client, output, signal);
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

function cloneEffect(effect: AnyEffect) {
    const effectConstructor = effect.constructor as new (...args: any[]) => AnyEffect;
    effect = new effectConstructor(...Object.values(effect));
    return effect;
}
