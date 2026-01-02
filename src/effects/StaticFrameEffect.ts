
import { addWhiteIfMissing, LedType, LedValue, RgbValue, RgbwValue } from './Color';

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
        const frame: LedValue[] = [];
        for (let i = 0; i < input.led_count; i++) {
            const ratio = i / (input.led_count - 1);
            const red = Math.round(this.startColor.red + (this.endColor.red - this.startColor.red) * ratio);
            const green = Math.round(this.startColor.green + (this.endColor.green - this.startColor.green) * ratio);
            const blue = Math.round(this.startColor.blue + (this.endColor.blue - this.startColor.blue) * ratio);
            const white = Math.round(this.startColor.white + (this.endColor.white - this.startColor.white) * ratio);
            frame.push({ red, green, blue, white });
        }
        return frame;
    }
}
