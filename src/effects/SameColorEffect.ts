import { addWhiteIfMissing, getGradientColors, hasWhiteChannel, LedValue, RgbValue } from "./Color";

export interface SameColorEffect {
    getName(): string;
    getColors(): Iterable<LedValue>;
}

export class SimpleColorEffect implements SameColorEffect {
    constructor() {}
    getName(): string {
        return "Simple colors";
    }
    *getColors(): Iterable<LedValue> {
        while (true) {
            yield { red: 255, green: 0, blue: 0 };
            yield { red: 0, green: 255, blue: 0 };
            yield { red: 0, green: 0, blue: 255 };
        }
    }
}

export class SmoothSameColorEffect implements SameColorEffect {
    constructor(
        private readonly target: SameColorEffect,
        private readonly steps: number) {
    }
    getName(): string {
        return "Smooth " + this.target.getName();
    }
    *getColors(): Iterable<LedValue> {
        let previous: LedValue | null = null;
        for (const targetColor of this.target.getColors()) {
            if (!previous) {
                yield targetColor;
            } else {
                const gradientColors = getGradientColors(previous, targetColor, this.steps);
                // Skip the first color (index 0) as it's the previous color
                for (let i = 1; i < gradientColors.length; i++) {
                    yield gradientColors[i];
                }
            }
            previous = targetColor;
        }
    }
}
