
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
    private readonly startColor: RgbwValue;
    private readonly endColor: RgbwValue
    constructor(
        startColor: RgbValue,
        endColor: RgbValue) {
        this.startColor = addWhiteIfMissing(startColor);
        this.endColor = addWhiteIfMissing(endColor);
    }
    getName(): string {
        return `Gradient from (${JSON.stringify(this.startColor)}) to (${JSON.stringify(this.endColor)})`;
    }
    getFrame(input: FrameInput): LedValue[] {
        return getGradientColors(this.startColor, this.endColor, input.led_count - 1);
    }
}
