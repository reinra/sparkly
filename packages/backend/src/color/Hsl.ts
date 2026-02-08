import { Hsl } from '@twinkly-ts/common';
import type { RgbValue } from './Color8bit';
import type { RgbFloat } from './ColorFloat';

export const RED_HSL_COLOR: Hsl = {
  hue: 0, // Red
  saturation: 1, // Full saturation
  lightness: 0.5, // Medium lightness
};
export const GREEN_HSL_COLOR: Hsl = {
  hue: 1 / 3, // Green
  saturation: 1, // Full saturation
  lightness: 0.5, // Medium lightness
};
export const BLUE_HSL_COLOR: Hsl = {
  hue: 2 / 3, // Blue
  saturation: 1, // Full saturation
  lightness: 0.5, // Medium lightness
};
export const WHITE_HSL_COLOR: Hsl = {
  hue: 0, // Hue is irrelevant for white
  saturation: 0, // No saturation for white
  lightness: 1, // White
};
export const BLACK_HSL_COLOR: Hsl = {
  hue: 0, // Red
  saturation: 0, // No saturation for black
  lightness: 0, // Black
};
export const DEFAULT_HSL_COLOR: Hsl = RED_HSL_COLOR;

// Helper function to handle the hue-to-RGB math
function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/**
 * Converts HSL color values to RGB.
 * @param h Hue as a fraction [0, 1] (0 = Red, 0.33 = Green, 0.66 = Blue)
 * @param s Saturation as a fraction [0, 1]
 * @param l Lightness as a fraction [0, 1]
 * @returns Color tuple [r, g, b] in range [0, 255]
 */
export function hslToRgb(hsl: Hsl): RgbValue {
  let r: number, g: number, b: number; // 0..1

  if (hsl.saturation === 0) {
    r = g = b = hsl.lightness; // Achromatic (gray)
  } else {
    const q =
      hsl.lightness < 0.5
        ? hsl.lightness * (1 + hsl.saturation)
        : hsl.lightness + hsl.saturation - hsl.lightness * hsl.saturation;
    const p = 2 * hsl.lightness - q;
    r = hueToRgb(p, q, hsl.hue + 1 / 3);
    g = hueToRgb(p, q, hsl.hue);
    b = hueToRgb(p, q, hsl.hue - 1 / 3);
  }

  return { red: Math.round(r * 255), green: Math.round(g * 255), blue: Math.round(b * 255) };
}

/**
 * Converts HSL color values to RGB float format.
 * @param hsl HSL color
 * @returns Color in RgbFloat format with values in range [0, 1]
 */
export function hslToRgbFloat(hsl: Hsl): RgbFloat {
  let r: number, g: number, b: number; // 0..1

  if (hsl.saturation === 0) {
    r = g = b = hsl.lightness; // Achromatic (gray)
  } else {
    const q =
      hsl.lightness < 0.5
        ? hsl.lightness * (1 + hsl.saturation)
        : hsl.lightness + hsl.saturation - hsl.lightness * hsl.saturation;
    const p = 2 * hsl.lightness - q;
    r = hueToRgb(p, q, hsl.hue + 1 / 3);
    g = hueToRgb(p, q, hsl.hue);
    b = hueToRgb(p, q, hsl.hue - 1 / 3);
  }

  return { red_f: r, green_f: g, blue_f: b };
}

export function lerpHsl(color1: Hsl, color2: Hsl, t: number): Hsl {
  // Handle hue interpolation with wrap-around
  let hueDiff = color2.hue - color1.hue;
  if (hueDiff > 0.5) {
    hueDiff -= 1; // Wrap around the hue circle
  } else if (hueDiff < -0.5) {
    hueDiff += 1; // Wrap around the hue circle
  }
  const hue = (color1.hue + hueDiff * t + 1) % 1; // Ensure hue stays in [0, 1]
  const saturation = color1.saturation + (color2.saturation - color1.saturation) * t;
  const lightness = color1.lightness + (color2.lightness - color1.lightness) * t;
  return { hue, saturation, lightness };
}

/**
 * Multiplies the lightness of an HSL color by a given intensity, clamping the result between 0 and 1.
 * @param color The original HSL color
 * @param intensity The intensity multiplier (0 = black, 1 = original color, >1 = brighter)
 * @returns A new HSL color with adjusted lightness
 */
export function multiplyIntensity(color: Hsl, intensity: number): Hsl {
  return { ...color, lightness: Math.max(0, Math.min(1, color.lightness * intensity)) };
}

export function randomColorBetween(color1: Hsl, color2: Hsl): Hsl {
  const t = Math.random();
  return lerpHsl(color1, color2, t);
}

export function randomColorMaxSaturation(): Hsl {
  return { hue: Math.random(), saturation: 1, lightness: 0.5 };
}
