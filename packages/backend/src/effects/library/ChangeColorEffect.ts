import { type EffectParameterView, type ParameterValue, MultiParameterStorageView } from '../../EffectParameters';
import { hslToRgbFloat } from '../../color/Hsl';
import { lerp, type RgbFloat } from '../../color/ColorFloat';
import { BLUE_HSL_COLOR, GREEN_HSL_COLOR, RED_HSL_COLOR, YELLOW_HSL_COLOR } from '../../color/Hsl';
import {
  AnimationMode,
  type EffectContextLoop,
  type EffectLoop,
  type EffectLogic,
  type EffectPreset,
  type LedPoint1D,
} from '../Effect';
import { BaseSameColorEffectLogic } from '../BaseEffects';
import { PaletteParameters, PaletteType, MultipleMode, RainbowMode } from '../util/Palette';
import { EasingParameters, EasingMode } from '../util/EasingMode';
import { type Hsl, hslColorValue } from '../../ParameterTypes';

const ORANGE_HSL: Hsl = { hue: 30 / 360, saturation: 1, lightness: 0.5 };
const CYAN_HSL: Hsl = { hue: 180 / 360, saturation: 1, lightness: 0.5 };
const PURPLE_HSL: Hsl = { hue: 270 / 360, saturation: 1, lightness: 0.5 };
const DARK_RED_HSL: Hsl = { hue: 0, saturation: 1, lightness: 0.25 };

export class ChangeColorEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  readonly effectClassId = 'change_color';
  readonly category = 'simple' as const;
  readonly palette = new PaletteParameters();
  readonly easing = new EasingParameters();
  public readonly parameters: EffectParameterView = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['palette.', this.palette.parameters],
      ['easing.', this.easing.parameters],
    ])
  );
  pointType: '1D' = '1D';
  isStateful: boolean = true;

  getPresets(): EffectPreset[] {
    return [
      // Flip presets (instant color change)
      ChangeColorEffect.multiplePreset(
        'flip_rgb',
        'Flip RGB',
        [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
        EasingMode.Noop
      ),
      ChangeColorEffect.multiplePreset(
        'flip_rgby',
        'Flip RGBY',
        [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR, YELLOW_HSL_COLOR],
        EasingMode.Noop
      ),
      // Fade presets (smooth color transitions)
      ChangeColorEffect.multiplePreset('change_color_rgb', 'Change Color: RGB', [
        RED_HSL_COLOR,
        GREEN_HSL_COLOR,
        BLUE_HSL_COLOR,
      ]),
      ChangeColorEffect.multiplePreset('change_color_rgby', 'Change Color: RGBY', [
        RED_HSL_COLOR,
        GREEN_HSL_COLOR,
        BLUE_HSL_COLOR,
        YELLOW_HSL_COLOR,
      ]),
      // Rainbow presets
      ChangeColorEffect.rainbowPreset('fade_rainbow', 'Fade Rainbow'),
      ChangeColorEffect.rainbowPreset('smooth_rainbow', 'Smooth Rainbow', EasingMode.Sine),
      ChangeColorEffect.rainbowPreset('snap_rainbow', 'Snap Rainbow', EasingMode.Exponential),
      // Random color preset
      ChangeColorEffect.simplePreset('random_colors', 'Random Colors', PaletteType.RandomColorRgb),
      // Themed presets
      ChangeColorEffect.multiplePreset(
        'warm_pulse',
        'Warm Pulse',
        [RED_HSL_COLOR, ORANGE_HSL, YELLOW_HSL_COLOR],
        EasingMode.Sine
      ),
      ChangeColorEffect.multiplePreset(
        'cool_pulse',
        'Cool Pulse',
        [BLUE_HSL_COLOR, CYAN_HSL, PURPLE_HSL],
        EasingMode.Sine
      ),
      ChangeColorEffect.multiplePreset(
        'fire',
        'Fire',
        [RED_HSL_COLOR, ORANGE_HSL, YELLOW_HSL_COLOR, DARK_RED_HSL],
        EasingMode.Noop,
        MultipleMode.Random
      ),
    ];
  }

  private static simplePreset(id: string, name: string, paletteType: PaletteType, easing?: EasingMode): EffectPreset {
    const config = new Map<string, ParameterValue>([['custom.palette.type', paletteType]]);
    if (easing !== undefined) {
      config.set('custom.easing.type', easing);
    }
    return { id, name, config };
  }

  private static rainbowPreset(id: string, name: string, easing?: EasingMode): EffectPreset {
    const config = new Map<string, ParameterValue>([
      ['custom.palette.type', PaletteType.RandomSaturatedHsl],
      ['custom.palette.rainbowMode', RainbowMode.Random],
    ]);
    if (easing !== undefined) {
      config.set('custom.easing.type', easing);
    }
    return { id, name, config };
  }

  private static multiplePreset(
    id: string,
    name: string,
    colors: Hsl[],
    easing?: EasingMode,
    order: MultipleMode = MultipleMode.RoundRobin
  ): EffectPreset {
    const config = new Map<string, ParameterValue>([
      ['custom.palette.type', PaletteType.Multiple],
      ['custom.palette.multipleOrder', order],
      ['custom.palette.colors', colors.map(hslColorValue) as ParameterValue],
    ]);
    if (easing !== undefined) {
      config.set('custom.easing.type', easing);
    }
    return { id, name, config };
  }

  getLoopDurationSeconds(_ledCount: number): number {
    return 2;
  }

  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => new ChangeColorEffectLogic(this);
}

class ChangeColorEffectLogic extends BaseSameColorEffectLogic<AnimationMode.Loop> {
  private fromColor;
  private toColor;
  private previousPhase = 0;

  constructor(private readonly config: ChangeColorEffect) {
    super();
    this.fromColor = config.palette.palette.nextColor().asRgb();
    this.toColor = config.palette.palette.nextColor().asRgb();
  }

  renderColor(ctx: EffectContextLoop): RgbFloat {
    // Detect phase wrap-around to advance to the next color
    if (ctx.phase < this.previousPhase) {
      this.fromColor = this.toColor;
      this.toColor = this.config.palette.palette.nextColor().asRgb();
    }
    this.previousPhase = ctx.phase;

    const easedPhase = this.config.easing.getInEasingFunction()(ctx.phase);
    return lerp(this.fromColor, this.toColor, easedPhase);
  }
}
