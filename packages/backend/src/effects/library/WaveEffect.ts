import { ParameterType } from '../../ParameterTypes';
import { type RgbFloat } from '../../color/ColorFloat';
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
import { type Hsl, hslColorValue } from '../../ParameterTypes';

export class WaveEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  readonly effectClassId = 'wave';
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
    easing?: EasingMode
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
    const easingFn = this.config.easing.getEasingFunction();

    // Track phase wrap-arounds to build an unwrapped total phase
    if (ctx.phase < this.previousPhase) {
      this.cycleCount++;
    }
    this.previousPhase = ctx.phase;
    const totalPhase = ctx.phase + this.cycleCount;

    // Compute the range of visible wave instance IDs and pre-generate colors
    const minWaveId = Math.floor(totalPhase * n);
    const maxWaveId = Math.floor((1 + totalPhase) * n);
    this.ensureColor(maxWaveId);

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

      // Easing shapes the brightness envelope of each wave
      const brightness = easingFn(localPhase);
      const color = this.colorHistory[waveInstanceId - this.baseWaveId];

      result[point.id] = {
        red: color.red * brightness,
        green: color.green * brightness,
        blue: color.blue * brightness,
      };
    }
    return result;
  }
}
