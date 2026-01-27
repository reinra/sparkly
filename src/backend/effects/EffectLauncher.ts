import { Mode } from "../../apiContract";
import type { Device } from "../deviceList";
import { MultipleFrameOutputStream, BufferReplacingFrameOutputStream, MappedFrameOutputStream, ApiClientFrameOutputStream } from "../render/FrameOutputStream";
import { IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper, type LedMapper } from "../render/LedMapper";
import { AnyEffectRenderer, type AnyEffect } from "../render/Renderer";

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
  await device.api_client.setMode(Mode.rt);
  if ("isStateful" in effect && effect.isStateful) {
    // If the effect is stateful, we should not share it between multiple devices
    effect = cloneEffect(effect);
  }
  await renderer.render(effect, device.api_client, output, signal);
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
