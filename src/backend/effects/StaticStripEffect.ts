import { getMultiGradientColors, LedType } from '../render/Color';
import type { LedValue, RgbValue } from '../render/Color';

export interface FrameInput {
  led_type: LedType;
  led_count: number;
}

export interface StaticStripEffect {
  getName(): string;
  getFrame(input: FrameInput): LedValue[];
}

export class GradientStaticStripEffect implements StaticStripEffect {
  constructor(private readonly colors: LedValue[]) {}
  getName(): string {
    return `Gradient between (${JSON.stringify(this.colors)})`;
  }
  getFrame(input: FrameInput): LedValue[] {
    const result = Array.from(getMultiGradientColors(this.colors, input.led_count / (this.colors.length - 1)));
    result.splice(input.led_count); // Ensure exact length - may be off due to rounding
    return result;
  }
}
