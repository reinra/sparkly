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
        private readonly framesPerRotation: number) {
    }
    getName(): string {
        return `Rotating ${this.target.getName()}`;
    }
    *getFrames(input: FrameInput): Iterable<LedValue[]> {
        while (true) {
            for (let frameIndex = 0; frameIndex < this.framesPerRotation; frameIndex++) {
                console.log(`Frame index: ${frameIndex}`);
                const baseFrame = this.target.getFrame(input);
                const segmentLength = input.led_count / this.framesPerRotation;
                const ledValues: LedValue[] = [];
                for (let i = 0; i < input.led_count; i++) {
                    const sourceIndex = (i + Math.floor(frameIndex * segmentLength)) % input.led_count;
                    ledValues.push(baseFrame[sourceIndex]);
                }
                yield ledValues;
            }
        }
    }
}
