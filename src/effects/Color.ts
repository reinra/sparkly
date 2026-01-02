
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
