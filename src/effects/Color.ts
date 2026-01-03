
export enum LedType {
    RGB = 'RGB',
    RGBW = 'RGBW'
}

export interface RgbValue {
    red: number;
    green: number;
    blue: number;
}

export interface RgbwValue extends RgbValue {
    white: number;
}

export type LedValue = RgbValue | RgbwValue;

export function hasWhiteChannel(value: LedValue): value is RgbwValue {
    return (value as RgbwValue).white !== undefined;
}

export function addWhiteIfMissing(value: LedValue): RgbwValue {
    if (hasWhiteChannel(value)) {
        return value;
    }
    return { ...value, white: 0 };
}

export function getGradientColors(start: RgbValue, end: RgbValue, steps: number): RgbValue[];
export function getGradientColors(start: RgbwValue, end: RgbValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbwValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbwValue, end: RgbwValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbValue, steps: number, skipLast: boolean): RgbValue[];
export function getGradientColors(start: RgbwValue, end: RgbValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbwValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(start: RgbwValue, end: RgbwValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(start: LedValue, end: LedValue, steps: number, skipLast: boolean = false): LedValue[] {
    const colorSteps = skipLast ? steps : steps - 1;
    if (hasWhiteChannel(start) || hasWhiteChannel(end)) {
        const whiteStart = addWhiteIfMissing(start);
        const whiteEnd = addWhiteIfMissing(end);
        const colors: RgbwValue[] = [];
        const diffR = (whiteEnd.red - whiteStart.red) / colorSteps;
        const diffG = (whiteEnd.green - whiteStart.green) / colorSteps;
        const diffB = (whiteEnd.blue - whiteStart.blue) / colorSteps;
        const diffW = (whiteEnd.white - whiteStart.white) / colorSteps;
        for (let step = 0; step < steps; step++) {
            colors.push({
                red: Math.round(whiteStart.red + diffR * step),
                green: Math.round(whiteStart.green + diffG * step),
                blue: Math.round(whiteStart.blue + diffB * step),
                white: Math.round(whiteStart.white + diffW * step),
            });
        }
        return colors;           
    }
    else {
        const colors: RgbValue[] = [];
        const diffR = (end.red - start.red) / colorSteps;
        const diffG = (end.green - start.green) / colorSteps;
        const diffB = (end.blue - start.blue) / colorSteps;
        for (let step = 0; step < steps; step++) {
            colors.push({
                red: Math.round(start.red + diffR * step),
                green: Math.round(start.green + diffG * step),
                blue: Math.round(start.blue + diffB * step),
            });
        }
        return colors;
    }
}   

export function getMultiGradientColors(colors: Iterable<RgbValue>, stepsPerColor: number): Iterable<RgbValue>;
export function getMultiGradientColors(colors: Iterable<RgbwValue>, stepsPerColor: number): Iterable<RgbwValue>;
export function *getMultiGradientColors(colors: Iterable<LedValue>, stepsPerColor: number): Iterable<LedValue> {
    if (stepsPerColor < 1) {
        throw new Error('stepsPerColor must be at least 1');
    }
    let previous: LedValue | null = null;
    for (const color of colors) {
        if (previous) {
            const gradientColors = getGradientColors(previous, color, stepsPerColor, true);
            for (const color of gradientColors) {
                yield color;
            }
        }
        previous = color;
    }
}
