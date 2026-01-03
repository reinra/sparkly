import { LedValue } from "./Color";
import { FrameInput, StaticStripEffect } from "./StaticStripEffect";

export interface StripEffect {
    getName(): string;
    getFrames(input: FrameInput): Iterable<LedValue[]>;
}

export class StaticStripEffectAdapter implements StripEffect {
    private cachedFrame: LedValue[] | null = null;
    constructor(private readonly target: StaticStripEffect) {
    }
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
        private readonly zoomFactor: number = 1) {
    }
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
                console.log(`Frame index: ${frameIndex}`);
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
