import type { LedValue } from '../../color/Color';
import type { FrameInput, StaticStripEffect } from './StaticStripEffect';
import { logger } from '../../logger';

export interface StripEffect {
  getName(): string;
  getFrames(input: FrameInput): Iterable<LedValue[]>;
}

export class StaticStripEffectAdapter implements StripEffect {
  private cachedFrame: LedValue[] | null = null;
  constructor(private readonly target: StaticStripEffect) {}
  getName(): string {
    return this.target.getName();
  }
  *getFrames(input: FrameInput): Iterable<LedValue[]> {
    if (this.cachedFrame === null) {
      this.cachedFrame = this.target.getFrame(input);
    }
    yield this.cachedFrame;
  }
}

export class RotatingStrictEffect implements StripEffect {
  constructor(
    private readonly target: StaticStripEffect,
    private readonly framesPerRotation: number,
    private readonly zoomFactor: number = 1
  ) {}
  getName(): string {
    return `Rotating ${this.target.getName()}`;
  }
  *getFrames(input: FrameInput): Iterable<LedValue[]> {
    const adjustedInput: FrameInput = {
      led_type: input.led_type,
      led_count: Math.floor(input.led_count * this.zoomFactor),
    };
    while (true) {
      for (let frameIndex = 0; frameIndex < this.framesPerRotation * this.zoomFactor; frameIndex++) {
        logger.trace(`Frame index: ${frameIndex}`);
        const baseFrame = this.target.getFrame(adjustedInput);
        const segmentLength = adjustedInput.led_count / this.framesPerRotation;
        const ledValues: LedValue[] = [];
        for (let i = 0; i < input.led_count; i++) {
          const sourceIndex = Math.floor(i + frameIndex * segmentLength) % adjustedInput.led_count;
          ledValues.push(baseFrame[sourceIndex]);
        }
        yield ledValues;
      }
    }
  }
}

const black: LedValue = { red: 0, green: 0, blue: 0 } as const;
const white: LedValue = { red: 255, green: 255, blue: 255 } as const;

export class TestPerLedEffect implements StripEffect {
  private cachedFrames: LedValue[] | null = null;
  getName(): string {
    return `Test Per LED Effect`;
  }
  *getFrames(input: FrameInput): Iterable<LedValue[]> {
    if (this.cachedFrames === null || this.cachedFrames.length !== input.led_count) {
      this.cachedFrames = Array.from({ length: input.led_count }, () => black);
    }
    for (let i = 0; i < input.led_count; i++) {
      const frame = [...this.cachedFrames];
      frame[i] = white;
      yield frame;
    }
  }
}
