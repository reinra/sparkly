
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

export function getGradientColors(start: RgbwValue, end: RgbwValue, steps: number): RgbwValue[] {
    const colors: RgbwValue[] = [];
    const diffR = (end.red - start.red) / steps;
    const diffG = (end.green - start.green) / steps;
    const diffB = (end.blue - start.blue) / steps;
    const diffW = (end.white - start.white) / steps;
    for (let step = 0; step <= steps; step++) {
        colors.push({
            red: Math.round(start.red + diffR * step),
            green: Math.round(start.green + diffG * step),
            blue: Math.round(start.blue + diffB * step),
            white: Math.round(start.white + diffW * step),
        });
    }
    return colors;
}   
