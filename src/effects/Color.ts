
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
export function getGradientColors(start: LedValue, end: LedValue, steps: number): LedValue[] {
    if (hasWhiteChannel(start) || hasWhiteChannel(end)) {
        const whiteStart = addWhiteIfMissing(start);
        const whiteEnd = addWhiteIfMissing(end);
        const colors: RgbwValue[] = [];
        const diffR = (whiteEnd.red - whiteStart.red) / steps;
        const diffG = (whiteEnd.green - whiteStart.green) / steps;
        const diffB = (whiteEnd.blue - whiteStart.blue) / steps;
        const diffW = (whiteEnd.white - whiteStart.white) / steps;
        for (let step = 0; step <= steps; step++) {
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
        const diffR = (end.red - start.red) / steps;
        const diffG = (end.green - start.green) / steps;
        const diffB = (end.blue - start.blue) / steps;
        for (let step = 0; step <= steps; step++) {
            colors.push({
                red: Math.round(start.red + diffR * step),
                green: Math.round(start.green + diffG * step),
                blue: Math.round(start.blue + diffB * step),
            });
        }
        return colors;
    }
}   
