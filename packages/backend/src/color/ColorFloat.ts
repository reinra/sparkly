import { RgbValue, RgbwValue } from './Color8bit';

export interface RgbFloat {
  red_f: number; // 0...1
  green_f: number; // 0...1
  blue_f: number; // 0...1
}

export const BLACK: RgbFloat = { red_f: 0, green_f: 0, blue_f: 0 };
export const WHITE: RgbFloat = { red_f: 1, green_f: 1, blue_f: 1 };
export const RED: RgbFloat = { red_f: 1, green_f: 0, blue_f: 0 };
export const GREEN: RgbFloat = { red_f: 0, green_f: 1, blue_f: 0 };
export const BLUE: RgbFloat = { red_f: 0, green_f: 0, blue_f: 1 };
export const YELLOW: RgbFloat = { red_f: 1, green_f: 1, blue_f: 0 };
export const CYAN: RgbFloat = { red_f: 0, green_f: 1, blue_f: 1 };
export const MAGENTA: RgbFloat = { red_f: 1, green_f: 0, blue_f: 1 };

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
  }
  return {
    red: Math.round(color.red_f * 255),
    green: Math.round(color.green_f * 255),
    blue: Math.round(color.blue_f * 255),
  };
}

/**
 * Applies gamma correction to a color. Gamma is a value where 1 means no correction, less than 1 brightens the color, and greater than 1 darkens it.
 */
export function gammaCorrect(color: RgbFloat, gamma: number): RgbFloat;
export function gammaCorrect(color: RgbwFloat, gamma: number): RgbwFloat;
export function gammaCorrect(color: LedFloat, gamma: number): LedFloat {
  if (gamma === 1) {
    return color; // No correction needed
  }
  if (hasWhiteChannel(color)) {
    return {
      red_f: Math.pow(color.red_f, gamma),
      green_f: Math.pow(color.green_f, gamma),
      blue_f: Math.pow(color.blue_f, gamma),
      white_f: Math.pow(color.white_f, gamma),
    };
  }
  return {
    red_f: Math.pow(color.red_f, gamma),
    green_f: Math.pow(color.green_f, gamma),
    blue_f: Math.pow(color.blue_f, gamma),
  };
}

/**
 * Adjusts the color temperature of a color. Temperature is a value between -1 (cool/blue) and 1 (warm/orange).
 */
export function adjustColorTemperatureNormalized(color: RgbFloat, temperature: number): RgbFloat {
  if (temperature === 0) {
    return color; // No adjustment needed
  }
  // Clamp temperature between -1 (cool/blue) and 1 (warm/orange)
  const t = Math.max(-1, Math.min(1, temperature));

  if (t > 0) {
    // Warm shift: increase red, slightly reduce green, reduce blue
    return {
      red_f: Math.min(1, color.red_f + t * 0.3 * (1 - color.red_f)),
      green_f: Math.max(0, color.green_f - t * 0.1),
      blue_f: Math.max(0, color.blue_f - t * 0.5),
    };
  } else {
    // Cool shift: reduce red, slightly increase green, increase blue
    return {
      red_f: Math.max(0, color.red_f + t * 0.5), // t is negative, so this reduces
      green_f: Math.min(1, color.green_f - t * 0.1 * (1 - color.green_f)),
      blue_f: Math.min(1, color.blue_f - t * 0.3 * (1 - color.blue_f)),
    };
  }
}
