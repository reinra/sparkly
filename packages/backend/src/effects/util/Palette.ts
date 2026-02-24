import { Hsl } from '@twinkly-ts/common';
import { Color, HslColor, RgbColor } from '../../color/Color';
import { EffectParameterStorage } from '../../EffectParameters';
import {
  MultiHslEffectParameter,
  OptionEffectParameter,
  RangeEffectParameter,
  ParameterType,
} from '../../ParameterTypes';
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

export enum MultipleMode {
  Random = 'random',
  RoundRobin = 'round_robin',
}

export class RandomMultiplePalette implements Palette {
  constructor(private colors: Hsl[]) {
    if (colors.length === 0) {
      throw new Error('RandomMultiplePalette requires at least one color');
    }
  }
  nextColor(): Color {
    const index = Math.floor(Math.random() * this.colors.length);
    return new HslColor(this.colors[index]);
  }
}

export class RoundRobinPalette implements Palette {
  private index = 0;
  constructor(private colors: Hsl[]) {
    if (colors.length === 0) {
      throw new Error('RoundRobinPalette requires at least one color');
    }
  }
  nextColor(): Color {
    const color = new HslColor(this.colors[this.index]);
    this.index = (this.index + 1) % this.colors.length;
    return color;
  }
}

export enum RainbowMode {
  Rotate = 'rotate',
  Random = 'random',
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

export class RotatingRainbowPalette implements Palette {
  private hue = Math.random();
  constructor(private rateOfChange: number) {}
  nextColor(): Color {
    const hsl: Hsl = {
      hue: this.hue,
      saturation: 1,
      lightness: 0.5,
    };
    this.hue = (this.hue + this.rateOfChange) % 1;
    return new HslColor(hsl);
  }
}

export class RandomColorPalette implements Palette {
  nextColor(): Color {
    return new RgbColor({
      red: Math.random(),
      green: Math.random(),
      blue: Math.random(),
    });
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
        { value: PaletteType.RandomSaturatedHsl, label: 'Rainbow', description: 'Fully saturated rainbow colors' },
        {
          value: PaletteType.RandomColorRgb,
          label: 'Any color',
          description: 'Generate random colors in entire RGB space',
        },
      ],
    },
    () => this.onUpdate()
  );
  private readonly rainbowMode: OptionEffectParameter = this.parameters.register(
    {
      id: 'rainbowMode',
      name: 'Mode',
      description: 'How to generate rainbow colors',
      type: ParameterType.OPTION,
      value: RainbowMode.Rotate,
      options: [
        { value: RainbowMode.Rotate, label: 'Rotate', description: 'Smoothly rotate through the color wheel' },
        { value: RainbowMode.Random, label: 'Random', description: 'Pick random saturated colors' },
      ],
      hidden: this.shouldHideRainbowParameters(),
    },
    () => this.onUpdate()
  );
  private readonly colorRateOfChange: RangeEffectParameter = this.parameters.register(
    {
      id: 'colorRateOfChange',
      name: 'Color rate of change',
      description: 'How fast the hue rotates per step',
      type: ParameterType.RANGE,
      value: 1,
      min: 0.1,
      max: 50,
      step: 0.1,
      unit: '%',
      hidden: this.shouldHideColorRateOfChange(),
    },
    () => this.onUpdate()
  );
  private readonly multipleOrder: OptionEffectParameter = this.parameters.register(
    {
      id: 'multipleOrder',
      name: 'Order',
      description: 'How to pick the next color from the list',
      type: ParameterType.OPTION,
      value: MultipleMode.RoundRobin,
      options: [
        { value: MultipleMode.RoundRobin, label: 'Round-robin', description: 'Cycle through colors in order' },
        { value: MultipleMode.Random, label: 'Random', description: 'Pick a random color from the list' },
      ],
      hidden: this.shouldHideColorsParameter(),
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
      description: 'List of HSL colors to pick from',
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
    this.multipleOrder.hidden = this.shouldHideColorsParameter();
    this.rainbowMode.hidden = this.shouldHideRainbowParameters();
    this.colorRateOfChange.hidden = this.shouldHideColorRateOfChange();
    this.palette = this.newPalette();
  }
  private shouldHideColorParameter(): boolean {
    return this.type.value !== PaletteType.Static;
  }
  private shouldHideColorsParameter(): boolean {
    return this.type.value !== PaletteType.Multiple;
  }
  private shouldHideRainbowParameters(): boolean {
    return this.type.value !== PaletteType.RandomSaturatedHsl;
  }
  private shouldHideColorRateOfChange(): boolean {
    return this.type.value !== PaletteType.RandomSaturatedHsl || this.rainbowMode.value !== RainbowMode.Rotate;
  }
  private newPalette(): Palette {
    switch (this.type.value) {
      case PaletteType.Static:
        return new StaticPalette(new HslColor(this.color.value));
      case PaletteType.Multiple:
        return this.multipleOrder.value === MultipleMode.RoundRobin
          ? new RoundRobinPalette(this.colors.value)
          : new RandomMultiplePalette(this.colors.value);
      case PaletteType.RandomSaturatedHsl:
        return this.rainbowMode.value === RainbowMode.Rotate
          ? new RotatingRainbowPalette(this.colorRateOfChange.value / 100)
          : new RandomSaturatedHslPalette();
      case PaletteType.RandomColorRgb:
        return new RandomColorPalette();
      default:
        throw new Error(`Unsupported palette type: ${this.type.value}`);
    }
  }
}
