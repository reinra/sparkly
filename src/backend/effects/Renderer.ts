import { TwinklyApiClient } from '../apiClient';
import { logger } from '../logger';
import type { LedValue } from './Color';
import { hasWhiteChannel, LedType } from './Color';
import type { LedMapper } from './LedMapper';
import type { SameColorEffect } from './SameColorEffect';
import type { StaticStripEffect } from './StaticStripEffect';
import type { StripEffect } from './StripEffect';

export interface Renderer<T> {
  render(effect: T, apiClient: TwinklyApiClient, mapper: LedMapper, signal: AbortSignal): void;
}

export type AnyEffect = SameColorEffect | StaticStripEffect | StripEffect;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
  private readonly sameColorEffectRenderer = new SameColorEffectRenderer();
  private readonly staticStripEffectRenderer = new StaticStripEffectRenderer();
  private readonly stripEffectRenderer = new StripEffectRenderer();
  async render(effect: AnyEffect, apiClient: TwinklyApiClient, mapper: LedMapper, signal: AbortSignal) {
    if ('getColors' in effect) {
      await this.sameColorEffectRenderer.render(effect, apiClient, mapper, signal);
    } else if ('getFrame' in effect) {
      await this.staticStripEffectRenderer.render(effect, apiClient, mapper, signal);
    } else if ('getFrames' in effect) {
      await this.stripEffectRenderer.render(effect, apiClient, mapper, signal);
    } else {
      throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
    }
  }
}

export class SameColorEffectRenderer implements Renderer<SameColorEffect> {
  async render(effect: SameColorEffect, apiClient: TwinklyApiClient, _mapper: LedMapper, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const colors = effect.getColors();
    const maxIterations = 1000;
    let i = 0;
    for (const color of colors) {
      signal.throwIfAborted();
      const ledValues: number[] = [];
      for (let i = 0; i < numberOfLeds; i++) {
        await copyValues(color, gestalt.led_profile, ledValues);
      }
      logger.withMetadata({ color, device: apiClient.getIp() }).debug(`Sending '${effect.getName()}' LED values`);
      await apiClient.sendLedValues(ledValues);

      i++;
      if (i >= maxIterations) {
        break;
      }
      await sleep(10);
    }
  }
}

export class StaticStripEffectRenderer implements Renderer<StaticStripEffect> {
  async render(effect: StaticStripEffect, apiClient: TwinklyApiClient, mapper: LedMapper, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frame = effect.getFrame({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    if (frame.length !== numberOfLeds) {
      throw new Error(`Effect frame length ${frame.length} does not match number of LEDs ${numberOfLeds}`);
    }
    const mappedFrame = applyMapper(frame, mapper);
    const ledValues: number[] = [];
    logger
      .withMetadata({ device: apiClient.getIp() })
      .debug(`Sending '${effect.getName()}' ${numberOfLeds} LED values`);
    let i = 0;
    for (const color of mappedFrame) {
      i++;
      logger.withMetadata({ color }).debug(`LED ${i}`);
      await copyValues(color, gestalt.led_profile, ledValues);
    }
    await apiClient.sendLedValues(ledValues);
  }
}

export class StripEffectRenderer implements Renderer<StripEffect> {
  async render(effect: StripEffect, apiClient: TwinklyApiClient, mapper: LedMapper, signal: AbortSignal) {
    const gestalt = await apiClient.gestalt();
    const numberOfLeds = gestalt.number_of_led;
    const frames = effect.getFrames({ led_type: gestalt.led_profile, led_count: numberOfLeds });
    const maxIterations = 1000;
    let i = 0;
    for (const frame of frames) {
      signal.throwIfAborted();
      if (frame.length !== numberOfLeds) {
        throw new Error(`Effect frame length ${frame.length} does not match number of LEDs ${numberOfLeds}`);
      }
      const mappedFrame = applyMapper(frame, mapper);
      const ledValues: number[] = [];
      for (const color of mappedFrame) {
        await copyValues(color, gestalt.led_profile, ledValues);
      }
      logger.withMetadata({ device: apiClient.getIp() }).debug(`Sending '${effect.getName()}' LED values`);
      await apiClient.sendLedValues(ledValues);
      i++;
      if (i >= maxIterations) {
        break;
      }
      await sleep(10);
    }
  }
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function applyMapper(frame: LedValue[], mapper: LedMapper): LedValue[] {
  const result: LedValue[] = new Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const mappedIndex = mapper.mapLedIndex(i);
    if (mappedIndex < 0 || mappedIndex >= frame.length) {
      throw new Error(`Mapped LED index ${mappedIndex} is out of bounds for frame length ${frame.length}`);
    }
    result[mappedIndex] = frame[i];
  }
  return result;
}

async function copyValues(color: LedValue, targetType: LedType, output: number[]) {
  if (targetType === LedType.RGB) {
    // Ignore white even if provided
    output.push(color.red, color.green, color.blue);
  } else if (hasWhiteChannel(color)) {
    output.push(color.white, color.red, color.green, color.blue);
  } else {
    output.push(0, color.red, color.green, color.blue);
  }
}
