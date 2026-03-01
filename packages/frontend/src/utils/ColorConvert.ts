import type { Hsl, RgbFloat } from '@sparkly/common';

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Convert HSL (all components 0–1) to RgbFloat (all components 0–1). */
export function hslToRgbFloat(hsl: Hsl): RgbFloat {
  let r: number, g: number, b: number;

  if (hsl.saturation === 0) {
    r = g = b = hsl.lightness;
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

  return { red: r, green: g, blue: b };
}

/** Convert RgbFloat (all components 0–1) to HSL (all components 0–1). */
export function rgbFloatToHsl(rgb: RgbFloat): Hsl {
  const red = Math.max(0, Math.min(1, rgb.red));
  const green = Math.max(0, Math.min(1, rgb.green));
  const blue = Math.max(0, Math.min(1, rgb.blue));

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  hue /= 6;

  return { hue, saturation, lightness };
}
