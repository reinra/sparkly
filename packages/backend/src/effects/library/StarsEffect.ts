import { type RgbFloat, BLACK, lerp } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../EffectParameters';
import { ParameterType } from '../../ParameterTypes';
import {
  AnimationMode,
  type EffectSequence,
  type EffectContextSequence,
  type LedPoint1D,
  type EffectLogic,
} from '../Effect';
import { FullEasingParameters } from '../util/EasingMode';
import { PaletteParameters } from '../util/Palette';
import { createBlackBuffer } from '../util/ArrayUtils';

/**
 * Stars effect — random LEDs light up like stars, each with a random duration
 * and color from the palette. Stars fade in and out using the configured easing.
 */
export class StarsEffect implements EffectSequence<LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
  readonly effectClassId = 'stars';
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly effectId = 'stars';
  readonly effectName = 'Stars';

  readonly customParams = new EffectParameterStorage();
  private readonly coverage = this.customParams.register({
    id: 'coverage',
    name: 'Coverage',
    description: 'Percentage of LEDs active as stars (0.0 - 100.0)%',
    type: ParameterType.RANGE,
    value: 10,
    min: 0,
    max: 100,
    unit: '%',
  });
  private readonly minDuration = this.customParams.register({
    id: 'min_duration',
    name: 'Min Star Duration',
    description: 'Minimum duration of a star in seconds',
    type: ParameterType.RANGE,
    value: 0.5,
    min: 0.1,
    max: 10,
    step: 0.1,
    unit: 's',
  });
  private readonly maxDuration = this.customParams.register({
    id: 'max_duration',
    name: 'Max Star Duration',
    description: 'Maximum duration of a star in seconds',
    type: ParameterType.RANGE,
    value: 6,
    min: 0.1,
    max: 10,
    step: 0.1,
    unit: 's',
  });

  readonly palette = new PaletteParameters();
  readonly easing = new FullEasingParameters();

  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
      ['easing.', this.easing.parameters],
    ])
  );

  getStarCount(ledCount: number): number {
    return Math.max(1, Math.round(ledCount * (this.coverage.value / 100)));
  }

  /** Returns random star duration in milliseconds. */
  getRandomDuration(): number {
    const min = this.minDuration.value * 1000;
    const max = Math.max(min, this.maxDuration.value * 1000);
    return min + Math.random() * (max - min);
  }

  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new StarsLogic(this);
}

interface Star {
  index: number;
  color: RgbFloat;
  durationMs: number;
  /** Accumulated age in milliseconds. */
  age: number;
}

class StarsLogic implements EffectLogic<AnimationMode.Sequence, LedPoint1D> {
  private stars: Star[] = [];
  private initialized = false;
  private lastLedCount = 0;

  constructor(private readonly config: StarsEffect) {}

  private randomIndex(total: number): number {
    return Math.floor(Math.random() * total);
  }

  private createStar(total: number, randomAge: boolean): Star {
    const duration = this.config.getRandomDuration();
    return {
      index: this.randomIndex(total),
      color: this.config.palette.palette.nextColor().asRgb(),
      durationMs: duration,
      age: randomAge ? Math.random() * duration : 0,
    };
  }

  private initialize(total: number): void {
    const count = this.config.getStarCount(total);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(total, true));
    }
    this.initialized = true;
    this.lastLedCount = total;
  }

  renderGlobal(ctx: EffectContextSequence, _points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;

    if (!this.initialized || this.lastLedCount !== total) {
      this.initialize(total);
    }

    const easingFn = this.config.easing.getEasingFunction();
    const buffer = createBlackBuffer(total);

    // Adjust star count if coverage changed
    const targetCount = this.config.getStarCount(total);
    while (this.stars.length < targetCount) {
      this.stars.push(this.createStar(total, true));
    }
    while (this.stars.length > targetCount) {
      this.stars.pop();
    }

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      star.age += ctx.delta_time_ms;

      // Star completed its lifecycle — respawn
      if (star.age >= star.durationMs) {
        this.stars[i] = this.createStar(total, false);
        continue;
      }

      const progress = star.age / star.durationMs;
      const brightness = easingFn(progress);

      if (brightness > 0) {
        buffer[star.index] = lerp(BLACK, star.color, brightness);
      }
    }

    return buffer;
  }
}
