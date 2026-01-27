export enum LedType {
  RGB = 'RGB',
  RGBW = 'RGBW',
}

export interface RgbValue {
  red: number; // 0-255
  green: number; // 0-255
  blue: number; // 0-255
}

export const BLACK: RgbValue = { red: 0, green: 0, blue: 0 };
export const WHITE: RgbValue = { red: 255, green: 255, blue: 255 };

export interface RgbwValue extends RgbValue {
  white: number; // 0-255
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

/**
   * Linearly interpolates between two colors.
   * @param c1 Start color
   * @param c2 End color
   * @param t Progress (0.0 - 1.0)
   */
  export function lerp(c1: RgbValue, c2: RgbValue, t: number): RgbValue {
    // Clamp t between 0 and 1
    t = Math.max(0, Math.min(1, t));
    
    return { red: Math.round(c1.red + (c2.red - c1.red) * t),
             green: Math.round(c1.green + (c2.green - c1.green) * t),
             blue: Math.round(c1.blue + (c2.blue - c1.blue) * t) };
}

/**
   * Blends a new color over an existing one (Alpha Compositing)
   */
export function blend(background: RgbValue, foreground: RgbValue, opacity: number): RgbValue {
    return lerp(background, foreground, opacity);
}

export function getGradientColors(start: RgbValue, end: RgbValue, steps: number): RgbValue[];
export function getGradientColors(start: RgbwValue, end: RgbValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbwValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbwValue, end: RgbwValue, steps: number): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbValue, steps: number, skipLast: boolean): RgbValue[];
export function getGradientColors(start: RgbwValue, end: RgbValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(start: RgbValue, end: RgbwValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(start: RgbwValue, end: RgbwValue, steps: number, skipLast: boolean): RgbwValue[];
export function getGradientColors(
  start: LedValue,
  end: LedValue,
  steps: number,
  skipLast: boolean = false
): LedValue[] {
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
  } else {
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
export function* getMultiGradientColors(colors: Iterable<LedValue>, stepsPerColor: number): Iterable<LedValue> {
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
