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

/**
 * Linearly interpolates between two colors.
 * @param c1 Start color
 * @param c2 End color
 * @param t Progress (0.0 - 1.0)
 */
export function lerp(c1: RgbValue, c2: RgbValue, t: number): RgbValue {
  // Clamp t between 0 and 1
  t = Math.max(0, Math.min(1, t));

  return {
    red: Math.round(c1.red + (c2.red - c1.red) * t),
    green: Math.round(c1.green + (c2.green - c1.green) * t),
    blue: Math.round(c1.blue + (c2.blue - c1.blue) * t),
  };
}

/**
 * Blends a new color over an existing one (Alpha Compositing)
 */
export function blend(background: RgbValue, foreground: RgbValue, opacity: number): RgbValue {
  return lerp(background, foreground, opacity);
}
