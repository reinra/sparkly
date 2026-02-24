import type { RgbFloat } from '@twinkly-ts/common';

export function formatRgbDisplay(color: RgbFloat): string {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const red = Math.round(clamp(color.red) * 255);
  const green = Math.round(clamp(color.green) * 255);
  const blue = Math.round(clamp(color.blue) * 255);
  return `${red} / ${green} / ${blue}`;
}
