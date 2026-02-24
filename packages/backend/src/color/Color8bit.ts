export enum LedType {
  RGB = 'RGB',
  RGBW = 'RGBW',
}

export interface Rgb24 {
  red8: number; // 0-255
  green8: number; // 0-255
  blue8: number; // 0-255
}

export const BLACK: Rgb24 = { red8: 0, green8: 0, blue8: 0 };
export const WHITE: Rgb24 = { red8: 255, green8: 255, blue8: 255 };

export interface Rgbw32 extends Rgb24 {
  white8: number; // 0-255
}

export type LedValue = Rgb24 | Rgbw32;

export function hasWhiteChannel(value: LedValue): value is Rgbw32 {
  return (value as Rgbw32).white8 !== undefined;
}

/**
 * Linearly interpolates between two colors.
 * @param c1 Start color
 * @param c2 End color
 * @param t Progress (0.0 - 1.0)
 */
export function lerp(c1: Rgb24, c2: Rgb24, t: number): Rgb24 {
  // Clamp t between 0 and 1
  t = Math.max(0, Math.min(1, t));

  return {
    red8: Math.round(c1.red8 + (c2.red8 - c1.red8) * t),
    green8: Math.round(c1.green8 + (c2.green8 - c1.green8) * t),
    blue8: Math.round(c1.blue8 + (c2.blue8 - c1.blue8) * t),
  };
}

/**
 * Blends a new color over an existing one (Alpha Compositing)
 */
export function blend(background: Rgb24, foreground: Rgb24, opacity: number): Rgb24 {
  return lerp(background, foreground, opacity);
}
