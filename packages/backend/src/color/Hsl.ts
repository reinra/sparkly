import type { RgbValue } from './Color8bit';

export interface Hsl {
  hue: number; // Hue: 0-1
  saturation: number; // Saturation: 0-1
  lightness: number; // Lightness: 0-1
}

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
