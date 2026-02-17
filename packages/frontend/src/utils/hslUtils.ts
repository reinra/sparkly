import type { Hsl } from '@twinkly-ts/common';

export function formatHslDisplay(color: Hsl): string {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const hue = Math.round(clamp(color.hue) * 360);
  const saturation = Math.round(clamp(color.saturation) * 100);
  const lightness = Math.round(clamp(color.lightness) * 100);
  return `${hue}° / ${saturation}% / ${lightness}%`;
}
