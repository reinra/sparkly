import { ParameterType } from '../../ParameterTypes';
import { type RgbFloat } from '../../color/ColorFloat';
import { BLUE_HSL_COLOR, GREEN_HSL_COLOR, RED_HSL_COLOR } from '../../color/Hsl';
import { EffectParameterStorage, type EffectParameterView, type ParameterValue, MultiParameterStorageView } from '../../effectParameters';
import { FullEasingParameters, EasingMode } from '../util/EasingMode';
import { AnimationMode, type EffectContextLoop, type EffectLoop, type EffectLogic, type EffectPreset, type LedPoint1D } from '../Effect';
import { PaletteParameters, PaletteType, MultipleMode } from '../util/Palette';
import type { Hsl } from '../../ParameterTypes';

export class WaveEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
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

  getName(): string {
    return 'Wave';
  }

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
      ['custom.palette.colors', colors],
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
  private waveColors: RgbFloat[];
  private previousPhase: number = -1;

  constructor(private readonly config: WaveEffect) {
    const n = config.numWaves.value;
    this.waveColors = [];
    for (let i = 0; i < n; i++) {
      this.waveColors.push(config.palette.palette.nextColor().asRgb());
    }
  }

  renderGlobal(ctx: EffectContextLoop, points: LedPoint1D[]): RgbFloat[] {
    const n = this.config.numWaves.value;
    const easingFn = this.config.easing.getEasingFunction();

    // Detect phase wrap-around to advance palette colors
    if (this.previousPhase >= 0 && ctx.phase < this.previousPhase) {
      this.waveColors.shift();
      this.waveColors.push(this.config.palette.palette.nextColor().asRgb());
    }
    this.previousPhase = ctx.phase;

    // Resize color array if numWaves parameter changed at runtime
    while (this.waveColors.length < n) {
      this.waveColors.push(this.config.palette.palette.nextColor().asRgb());
    }
    while (this.waveColors.length > n) {
      this.waveColors.pop();
    }

    const result: RgbFloat[] = new Array(points.length);
    for (const point of points) {
      // Scroll waves along the strip based on phase
      const scrolledPos = (((point.distance + ctx.phase) % 1.0) + 1.0) % 1.0;
      const scaledPos = scrolledPos * n;
      const waveIndex = Math.floor(scaledPos) % n;
      const localPhase = scaledPos - Math.floor(scaledPos);

      // Easing shapes the brightness envelope of each wave
      const brightness = easingFn(localPhase);
      const color = this.waveColors[waveIndex];

      result[point.id] = {
        red_f: color.red_f * brightness,
        green_f: color.green_f * brightness,
        blue_f: color.blue_f * brightness,
      };
    }
    return result;
  }
}
