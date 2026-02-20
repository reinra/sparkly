import { Hsl } from "@twinkly-ts/common";
import { Color, HslColor, RgbColor } from "../../color/Color";
import { EffectParameterStorage } from "../../effectParameters";
import { OptionEffectParameter, ParameterType } from "../../ParameterTypes";
import { DEFAULT_HSL_COLOR } from "../../color/Hsl";

export interface Palette {
    nextColor(): Color;
}

export enum PaletteType {
    Static = 'static',
    RandomSaturatedHsl = 'random_saturated_hsl',
    RandomColorRgb = 'random_color_rgb',
}

export class StaticPalette implements Palette {
    constructor(private color: Color) { }
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

export class PaletteParameters {
    public readonly parameters = new EffectParameterStorage();
    private readonly type: OptionEffectParameter = this.parameters.register({
        id: 'type',
        name: 'Palette Type',
        description: 'Type of color palette to use',
        type: ParameterType.OPTION,
        value: PaletteType.RandomSaturatedHsl,
        options: [
            { value: PaletteType.Static, label: 'Static', description: 'Use a single static color' },
            { value: PaletteType.RandomSaturatedHsl, label: 'Saturated', description: 'Generate random saturated colors' },
            { value: PaletteType.RandomColorRgb, label: 'Any color', description: 'Generate random colors in entire RGB space' },
        ],
    }, () => this.onUpdate());
    private readonly color = this.parameters.register({
        id: 'color',
        name: 'Color',
        description: 'HSL color value',
        type: ParameterType.HSL,
        value: DEFAULT_HSL_COLOR,
        hidden: this.shouldHideColorParameter(),    
    }, () => this.onUpdate());
    public palette: Palette = this.newPalette();
    onUpdate(): void {
        this.color.hidden = this.shouldHideColorParameter();
        this.palette = this.newPalette();
    }
    private shouldHideColorParameter(): boolean {
        return this.type.value !== PaletteType.Static;
    }
    private newPalette(): Palette {
        switch (this.type.value) {
            case PaletteType.Static:
                return new StaticPalette(new HslColor(this.color.value));
            case PaletteType.RandomSaturatedHsl:
                return new RandomSaturatedHslPalette();
            case PaletteType.RandomColorRgb:
                return new RandomColorPalette();
            default:
                throw new Error(`Unsupported palette type: ${this.type.value}`);    
        }
    }
}
