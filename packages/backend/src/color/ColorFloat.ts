import { Rgb24, Rgbw32 } from './Color8bit';

export interface RgbFloat {
  red: number; // 0...1
  green: number; // 0...1
  blue: number; // 0...1
}

export const BLACK: RgbFloat = { red: 0, green: 0, blue: 0 };
export const WHITE: RgbFloat = { red: 1, green: 1, blue: 1 };
export const RED: RgbFloat = { red: 1, green: 0, blue: 0 };
export const GREEN: RgbFloat = { red: 0, green: 1, blue: 0 };
export const BLUE: RgbFloat = { red: 0, green: 0, blue: 1 };
export const YELLOW: RgbFloat = { red: 1, green: 1, blue: 0 };
export const CYAN: RgbFloat = { red: 0, green: 1, blue: 1 };
export const MAGENTA: RgbFloat = { red: 1, green: 0, blue: 1 };

export interface RgbwFloat extends RgbFloat {
  white: number; // 0...1
}

export type LedFloat = RgbFloat | RgbwFloat;

export function hasWhiteChannel(value: LedFloat): value is RgbwFloat {
  return (value as RgbwFloat).white !== undefined;
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
    red: c1.red + (c2.red - c1.red) * t,
    green: c1.green + (c2.green - c1.green) * t,
    blue: c1.blue + (c2.blue - c1.blue) * t,
  };
}

/**
 * Blends a new color over an existing one (Alpha Compositing)
 */
export function blend(background: RgbFloat, foreground: RgbFloat, opacity: number): RgbFloat {
  return lerp(background, foreground, opacity);
}

export function floatTo8bit(color: RgbFloat): Rgb24;
export function floatTo8bit(color: RgbwFloat): Rgbw32;
export function floatTo8bit(color: LedFloat): Rgb24 | Rgbw32 {
  if (hasWhiteChannel(color)) {
    return {
      red8: Math.round(color.red * 255),
      green8: Math.round(color.green * 255),
      blue8: Math.round(color.blue * 255),
      white8: Math.round(color.white * 255),
    };
  }
  return {
    red8: Math.round(color.red * 255),
    green8: Math.round(color.green * 255),
    blue8: Math.round(color.blue * 255),
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
      red: Math.pow(color.red, gamma),
      green: Math.pow(color.green, gamma),
      blue: Math.pow(color.blue, gamma),
      white: Math.pow(color.white, gamma),
    };
  }
  return {
    red: Math.pow(color.red, gamma),
    green: Math.pow(color.green, gamma),
    blue: Math.pow(color.blue, gamma),
  };
}

/**
 * Applies per-channel gain to a color.
 * Gain is a percentage from -100 to 100, where 0 means no change,
 * positive values boost the channel, and negative values reduce it.
 */
export function applyChannelGain(color: RgbFloat, redGain: number, greenGain: number, blueGain: number): RgbFloat {
  if (redGain === 0 && greenGain === 0 && blueGain === 0) {
    return color; // No adjustment needed
  }
  return {
    red: Math.max(0, Math.min(1, color.red * (1 + redGain / 100))),
    green: Math.max(0, Math.min(1, color.green * (1 + greenGain / 100))),
    blue: Math.max(0, Math.min(1, color.blue * (1 + blueGain / 100))),
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
      red: Math.min(1, color.red + t * 0.3 * (1 - color.red)),
      green: Math.max(0, color.green - t * 0.1),
      blue: Math.max(0, color.blue - t * 0.5),
    };
  } else {
    // Cool shift: reduce red, slightly increase green, increase blue
    return {
      red: Math.max(0, color.red + t * 0.5), // t is negative, so this reduces
      green: Math.min(1, color.green - t * 0.1 * (1 - color.green)),
      blue: Math.min(1, color.blue - t * 0.3 * (1 - color.blue)),
    };
  }
}
