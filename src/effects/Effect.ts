
export interface RgbValue {
    red: number
    green: number
    blue: number
}

export interface SameColorEffect {
    getName(): string;
    getColors(): Iterable<RgbValue>;
}

export class SimpleColorEffect implements SameColorEffect {
    constructor() {}
    getName(): string {
        return "Simple colors";
    }
    *getColors(): Iterable<RgbValue> {
        while (true) {
            yield { red: 255, green: 0, blue: 0 };
            yield { red: 0, green: 255, blue: 0 };
            yield { red: 0, green: 0, blue: 255 };
            yield { red: 255, green: 255, blue: 0 };
            yield { red: 0, green: 255, blue: 255 };
            yield { red: 255, green: 0, blue: 255 };
            yield { red: 255, green: 255, blue: 255 };
        }
    }
}

export class SmoothSameColorEffect implements SameColorEffect {
    constructor(private readonly target: SameColorEffect,
        private readonly steps: number) {
    }
    getName(): string {
        return "Smooth " + this.target.getName();
    }
    *getColors(): Iterable<RgbValue> {
        let previous: RgbValue | null = null;
        for (const targetColor of this.target.getColors()) {
            if (!previous) {
                yield targetColor;
            }
            else {
                const diffR = (targetColor.red - previous.red) / this.steps;
                const diffG = (targetColor.green - previous.green) / this.steps
                const diffB = (targetColor.blue - previous.blue) / this.steps;
                for (let step = 1; step <= this.steps; step++) {
                    yield {
                        red: Math.round(previous.red + diffR * step),
                        green: Math.round(previous.green + diffG * step),
                        blue: Math.round(previous.blue + diffB * step),
                    };
                }
            }
            previous = targetColor;
        }
    }
}