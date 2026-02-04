import { RgbValue, RgbwValue } from './Color8bit';

export interface RgbFloat {
  red_f: number; // 0...1
  green_f: number; // 0...1
  blue_f: number; // 0...1
}

export const BLACK: RgbFloat = { red_f: 0, green_f: 0, blue_f: 0 };
export const WHITE: RgbFloat = { red_f: 1, green_f: 1, blue_f: 1 };

export interface RgbwFloat extends RgbFloat {
  white_f: number; // 0...1
}

export type LedFloat = RgbFloat | RgbwFloat;

export function hasWhiteChannel(value: LedFloat): value is RgbwFloat {
  return (value as RgbwFloat).white_f !== undefined;
}

/**
 * Linearly interpolates between two colors.
 * @param c1 Start color
 * @param c2 End color
 * @param t Progress (0.0 - 1.0)
 */
export function lerp(c1: RgbFloat, c2: RgbFloat, t: number): RgbFloat {
  // Clamp t between 0 and 1
  t = Math.max(0, Math.min(1, t));

  return {
    red_f: c1.red_f + (c2.red_f - c1.red_f) * t,
    green_f: c1.green_f + (c2.green_f - c1.green_f) * t,
    blue_f: c1.blue_f + (c2.blue_f - c1.blue_f) * t,
  };
}

/**
 * Blends a new color over an existing one (Alpha Compositing)
 */
export function blend(background: RgbFloat, foreground: RgbFloat, opacity: number): RgbFloat {
  return lerp(background, foreground, opacity);
}

export function floatTo8bit(color: RgbFloat): RgbValue;
export function floatTo8bit(color: RgbwFloat): RgbwValue;
export function floatTo8bit(color: LedFloat): RgbValue | RgbwValue {
  if (hasWhiteChannel(color)) {
    return {
      red: Math.round(color.red_f * 255),
      green: Math.round(color.green_f * 255),
      blue: Math.round(color.blue_f * 255),
      white: Math.round(color.white_f * 255),
    };
  } else {
    return {
      red: Math.round(color.red_f * 255),
      green: Math.round(color.green_f * 255),
      blue: Math.round(color.blue_f * 255),
    };
  }
}
