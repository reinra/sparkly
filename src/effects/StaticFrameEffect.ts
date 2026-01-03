
import { addWhiteIfMissing, getGradientColors, LedType, LedValue, RgbValue, RgbwValue } from './Color';

export interface FrameInput {
    led_type: LedType;
    led_count: number;
}

export interface StaticFrameEffect {
    getName(): string;
    getFrame(input: FrameInput): LedValue[];
}

export class GradientStaticFrameEffect implements StaticFrameEffect {
    constructor(
        private readonly startColor: LedValue,
        private readonly endColor: LedValue) {
    }
    getName(): string {
        return `Gradient from (${JSON.stringify(this.startColor)}) to (${JSON.stringify(this.endColor)})`;
    }
    getFrame(input: FrameInput): LedValue[] {
        return getGradientColors(this.startColor, this.endColor, input.led_count - 1);
    }
}
