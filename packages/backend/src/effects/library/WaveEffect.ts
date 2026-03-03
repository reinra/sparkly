import { ParameterType } from '../../ParameterTypes';
import { type RgbFloat, lerp } from '../../color/ColorFloat';
import { BLUE_HSL_COLOR, GREEN_HSL_COLOR, RED_HSL_COLOR } from '../../color/Hsl';
import {
  EffectParameterStorage,
  type EffectParameterView,
  type ParameterValue,
  MultiParameterStorageView,
} from '../../EffectParameters';
import { FullEasingParameters, EasingMode } from '../util/EasingMode';
import {
  AnimationMode,
  type EffectContextLoop,
  type EffectLoop,
  type EffectLogic,
  type EffectPreset,
  type LedPoint1D,
} from '../Effect';
import { PaletteParameters, PaletteType, MultipleMode } from '../util/Palette';
import { type Hsl, hslColorValue, type OptionEffectParameter } from '../../ParameterTypes';

export enum WaveBlendMode {
  FadeToBlack = 'fade_to_black',
  BlendColors = 'blend_colors',
}

export class WaveEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  readonly effectClassId = 'wave';
  readonly category = 'animated' as const;
  readonly customParams = new EffectParameterStorage();
  readonly numWaves = this.customParams.register({
    id: 'num_waves',
    name: 'Number of waves',
    description: 'How many waves are visible on the strip at once',
    type: ParameterType.RANGE,
    value: 3,
    min: 1,
    max: 10,
  });
  readonly blendMode = this.customParams.register(
    {
      id: 'blend_mode',
      name: 'Blend mode',
      description: 'How colors transition: fade through black or blend between adjacent colors',
      type: ParameterType.OPTION,
      value: WaveBlendMode.FadeToBlack,
      options: [
        {
          value: WaveBlendMode.FadeToBlack,
          label: 'Fade to black',
          description: 'Each wave fades to black at the edges',
        },
        {
          value: WaveBlendMode.BlendColors,
          label: 'Blend colors',
          description: 'Smooth gradient between adjacent colors',
        },
      ],
    },
    (_param: OptionEffectParameter, _oldValue: string, newValue: string) => {
      this.easing.direction.hidden = newValue === WaveBlendMode.BlendColors;
    }
  );
  readonly palette = new PaletteParameters();
  readonly easing = new FullEasingParameters();
  public readonly parameters: EffectParameterView = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
      ['easing.', this.easing.parameters],
    ])
  );
  pointType: '1D' = '1D';
  isStateful: boolean = true;

  getPresets(): EffectPreset[] {
    return [
      WaveEffect.preset('wave_rainbow', 'Wave: Rainbow', 3),
      WaveEffect.preset('wave_single_pulse', 'Wave: Single Pulse', 1, EasingMode.Cubic),
      WaveEffect.preset('wave_ripples', 'Wave: Ripples', 5),
      WaveEffect.multiplePreset('wave_rgb', 'Wave: RGB', 3, [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
      WaveEffect.multiplePreset(
        'wave_ocean',
        'Wave: Ocean',
        2,
        [
          { hue: 200 / 360, saturation: 1, lightness: 0.4 },
          { hue: 220 / 360, saturation: 0.8, lightness: 0.5 },
          { hue: 180 / 360, saturation: 0.9, lightness: 0.45 },
        ],
        EasingMode.Sine
      ),
      WaveEffect.multiplePreset(
        'wave_rainbow_blend',
        'Wave: Rainbow Blend',
        3,
        [
          { hue: 0, saturation: 1, lightness: 0.5 },
          { hue: 60 / 360, saturation: 1, lightness: 0.5 },
          { hue: 120 / 360, saturation: 1, lightness: 0.5 },
          { hue: 180 / 360, saturation: 1, lightness: 0.5 },
          { hue: 240 / 360, saturation: 1, lightness: 0.5 },
          { hue: 300 / 360, saturation: 1, lightness: 0.5 },
        ],
        EasingMode.Linear,
        WaveBlendMode.BlendColors
      ),
    ];
  }

  private static preset(id: string, name: string, numWaves: number, easing?: EasingMode): EffectPreset {
    const config = new Map<string, ParameterValue>([
      ['custom.custom.num_waves', numWaves],
      ['custom.palette.type', PaletteType.RandomSaturatedHsl],
    ]);
    if (easing !== undefined) {
      config.set('custom.easing.type', easing);
    }
    return { id, name, config };
  }

  private static multiplePreset(
    id: string,
    name: string,
    numWaves: number,
    colors: Hsl[],
    easing?: EasingMode,
    blendMode?: WaveBlendMode
  ): EffectPreset {
    const config = new Map<string, ParameterValue>([
      ['custom.custom.num_waves', numWaves],
      ['custom.palette.type', PaletteType.Multiple],
      ['custom.palette.multipleOrder', MultipleMode.RoundRobin],
      ['custom.palette.colors', colors.map(hslColorValue) as ParameterValue],
    ]);
    if (easing !== undefined) {
      config.set('custom.easing.type', easing);
    }
    if (blendMode !== undefined) {
      config.set('custom.custom.blend_mode', blendMode);
    }
    return { id, name, config };
  }

  getLoopDurationSeconds(_ledCount: number): number {
    return 5;
  }

  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => new WaveEffectLogic(this);
}

class WaveEffectLogic implements EffectLogic<AnimationMode.Loop, LedPoint1D> {
  /** Rolling buffer of colors, indexed by (waveInstanceId - baseWaveId) */
  private colorHistory: RgbFloat[] = [];
  /** The waveInstanceId corresponding to colorHistory[0] */
  private baseWaveId: number = 0;
  private previousPhase: number = 0;
  private cycleCount: number = 0;

  constructor(private readonly config: WaveEffect) {}

  private ensureColor(waveId: number): RgbFloat {
    const index = waveId - this.baseWaveId;
    while (index >= this.colorHistory.length) {
      this.colorHistory.push(this.config.palette.palette.nextColor().asRgb());
    }
    return this.colorHistory[index];
  }

  renderGlobal(ctx: EffectContextLoop, points: LedPoint1D[]): RgbFloat[] {
    const n = this.config.numWaves.value;
    const blendColors = this.config.blendMode.value === WaveBlendMode.BlendColors;
    // In blend mode, use base easing (always 0→1) since direction wrapping doesn't make sense for lerp
    const easingFn = blendColors ? this.config.easing.getBaseEasingFunction() : this.config.easing.getEasingFunction();

    // Track phase wrap-arounds to build an unwrapped total phase
    if (ctx.phase < this.previousPhase) {
      this.cycleCount++;
    }
    this.previousPhase = ctx.phase;
    const totalPhase = ctx.phase + this.cycleCount;

    // Compute the range of visible wave instance IDs and pre-generate colors
    const minWaveId = Math.floor(totalPhase * n);
    const maxWaveId = Math.floor((1 + totalPhase) * n);
    // In blend mode we also need the next color for interpolation
    this.ensureColor(maxWaveId + (blendColors ? 1 : 0));

    // Trim colors for waves that have fully scrolled off the strip
    const trimCount = minWaveId - this.baseWaveId;
    if (trimCount > 0) {
      this.colorHistory.splice(0, trimCount);
      this.baseWaveId += trimCount;
    }

    const result: RgbFloat[] = new Array(points.length);
    for (const point of points) {
      // Use unwrapped position so each wave instance gets a unique ID
      // that transitions at the dark boundary (localPhase = 0)
      const scaledPos = (point.distance + totalPhase) * n;
      const waveInstanceId = Math.floor(scaledPos);
      const localPhase = scaledPos - waveInstanceId;

      const color = this.colorHistory[waveInstanceId - this.baseWaveId];

      if (blendColors) {
        // Lerp between current and next color using the eased phase
        const nextColor = this.colorHistory[waveInstanceId - this.baseWaveId + 1];
        const t = easingFn(localPhase);
        result[point.id] = lerp(color, nextColor, t);
      } else {
        // Easing shapes the brightness envelope of each wave (fade to black)
        const brightness = easingFn(localPhase);
        result[point.id] = {
          red: color.red * brightness,
          green: color.green * brightness,
          blue: color.blue * brightness,
        };
      }
    }
    return result;
  }
}
