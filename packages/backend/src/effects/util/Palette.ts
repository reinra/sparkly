import { Hsl } from '@twinkly-ts/common';
import { Color, HslColor, RgbColor } from '../../color/Color';
import { EffectParameterStorage } from '../../effectParameters';
import { MultiHslEffectParameter, OptionEffectParameter, ParameterType } from '../../ParameterTypes';
import { BLUE_HSL_COLOR, DEFAULT_HSL_COLOR, GREEN_HSL_COLOR, RED_HSL_COLOR } from '../../color/Hsl';

export interface Palette {
  nextColor(): Color;
}

export enum PaletteType {
  Static = 'static',
  Multiple = 'multiple',
  RandomSaturatedHsl = 'random_saturated_hsl',
  RandomColorRgb = 'random_color_rgb',
}

export class StaticPalette implements Palette {
  constructor(private color: Color) {}
  nextColor(): Color {
    return this.color;
  }
}

export class RandomSaturatedHslPalette implements Palette {
  nextColor(): Color {
    const hsl: Hsl = {
      hue: Math.random(),
      saturation: 1,
      lightness: 0.5,
    };
    return new HslColor(hsl);
  }
}

export class RandomColorPalette implements Palette {
  nextColor(): Color {
    return new RgbColor({
      red_f: Math.random(),
      green_f: Math.random(),
      blue_f: Math.random(),
    });
  }
}

export class MultiplePalette implements Palette {
  constructor(private colors: Hsl[]) {
    if (colors.length === 0) {
      throw new Error('MultiplePalette requires at least one color');
    }
  }
  nextColor(): Color {
    const index = Math.floor(Math.random() * this.colors.length);
    return new HslColor(this.colors[index]);
  }
}

export class PaletteParameters {
  public readonly parameters = new EffectParameterStorage();
  private readonly type: OptionEffectParameter = this.parameters.register(
    {
      id: 'type',
      name: 'Palette',
      description: 'Type of color palette to use',
      type: ParameterType.OPTION,
      value: PaletteType.RandomSaturatedHsl,
      options: [
        { value: PaletteType.Static, label: 'Static', description: 'Use a single static color' },
        { value: PaletteType.Multiple, label: 'Multiple', description: 'Random color from a custom list' },
        { value: PaletteType.RandomSaturatedHsl, label: 'Saturated', description: 'Generate random saturated colors' },
        {
          value: PaletteType.RandomColorRgb,
          label: 'Any color',
          description: 'Generate random colors in entire RGB space',
        },
      ],
    },
    () => this.onUpdate()
  );
  private readonly color = this.parameters.register(
    {
      id: 'color',
      name: 'Color',
      description: 'HSL color value',
      type: ParameterType.HSL,
      value: DEFAULT_HSL_COLOR,
      hidden: this.shouldHideColorParameter(),
    },
    () => this.onUpdate()
  );
  private readonly colors: MultiHslEffectParameter = this.parameters.register(
    {
      id: 'colors',
      name: 'Colors',
      description: 'List of HSL colors to pick from randomly',
      type: ParameterType.MULTI_HSL,
      value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
      hidden: this.shouldHideColorsParameter(),
    },
    () => this.onUpdate()
  );
  public palette: Palette = this.newPalette();
  onUpdate(): void {
    this.color.hidden = this.shouldHideColorParameter();
    this.colors.hidden = this.shouldHideColorsParameter();
    this.palette = this.newPalette();
  }
  private shouldHideColorParameter(): boolean {
    return this.type.value !== PaletteType.Static;
  }
  private shouldHideColorsParameter(): boolean {
    return this.type.value !== PaletteType.Multiple;
  }
  private newPalette(): Palette {
    switch (this.type.value) {
      case PaletteType.Static:
        return new StaticPalette(new HslColor(this.color.value));
      case PaletteType.RandomSaturatedHsl:
        return new RandomSaturatedHslPalette();
      case PaletteType.RandomColorRgb:
        return new RandomColorPalette();
      case PaletteType.Multiple:
        return new MultiplePalette(this.colors.value);
      default:
        throw new Error(`Unsupported palette type: ${this.type.value}`);
    }
  }
}
