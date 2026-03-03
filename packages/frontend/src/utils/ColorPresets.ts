import type { Hsl } from '@sparkly/common';

export interface ColorPreset {
  name: string;
  hsl: Hsl;
}

/** Common color presets for quick selection in color pickers. */
export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Red', hsl: { hue: 0, saturation: 1, lightness: 0.5 } },
  { name: 'Orange', hsl: { hue: 0.083, saturation: 1, lightness: 0.5 } },
  { name: 'Yellow', hsl: { hue: 0.167, saturation: 1, lightness: 0.5 } },
  { name: 'Lime', hsl: { hue: 0.25, saturation: 1, lightness: 0.5 } },
  { name: 'Green', hsl: { hue: 0.333, saturation: 1, lightness: 0.5 } },
  { name: 'Teal', hsl: { hue: 0.472, saturation: 1, lightness: 0.4 } },
  { name: 'Cyan', hsl: { hue: 0.5, saturation: 1, lightness: 0.5 } },
  { name: 'Blue', hsl: { hue: 0.667, saturation: 1, lightness: 0.5 } },
  { name: 'Purple', hsl: { hue: 0.75, saturation: 1, lightness: 0.5 } },
  { name: 'Magenta', hsl: { hue: 0.833, saturation: 1, lightness: 0.5 } },
  { name: 'Pink', hsl: { hue: 0.917, saturation: 1, lightness: 0.7 } },
  { name: 'Warm White', hsl: { hue: 0.1, saturation: 0.3, lightness: 0.9 } },
  { name: 'White', hsl: { hue: 0, saturation: 0, lightness: 1 } },
  { name: 'Gray', hsl: { hue: 0, saturation: 0, lightness: 0.5 } },
  { name: 'Black', hsl: { hue: 0, saturation: 0, lightness: 0 } },
];

/**
 * Handle keyboard navigation within the preset grid.
 * Supports arrow keys to move between swatches, Home/End for first/last.
 */
export function handlePresetGridKeydown(
  event: KeyboardEvent,
  currentIndex: number,
  totalCount: number,
  onSelect: (index: number) => void
): void {
  let nextIndex: number | null = null;

  switch (event.key) {
    case 'ArrowRight':
      nextIndex = currentIndex < totalCount - 1 ? currentIndex + 1 : 0;
      break;
    case 'ArrowLeft':
      nextIndex = currentIndex > 0 ? currentIndex - 1 : totalCount - 1;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = totalCount - 1;
      break;
    default:
      return; // Don't prevent default for unhandled keys
  }

  event.preventDefault();
  onSelect(nextIndex);
}
