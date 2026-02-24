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
import { EasingParameters } from '../util/EasingMode';
import { FlashAnimation } from '../util/FlashAnimation';
import { PaletteParameters } from '../util/Palette';
import { createBlackBuffer, pickRandomFreeIndex } from '../util/ArrayUtils';

// ---------------------------------------------------------------------------
// Effect definition
// ---------------------------------------------------------------------------

/**
 * Simplified random-dots-then-flash effect.
 * Dots are spawned at random positions on the fly (no pre-shuffled index list).
 * Once coverage is reached the buffer flashes and restarts.
 */
export class RandomDotsClearEffect implements EffectSequence<LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly hasCycleReset = true;
  readonly effectId = 'random_dots_clear';
  readonly effectName = 'Random Dots Clear';

  readonly customParams = new EffectParameterStorage();
  private readonly coverage = this.customParams.register({
    id: 'coverage',
    name: 'Coverage',
    description: 'Approximate percentage of LEDs lit at once (0.0 - 100.0)%',
    type: ParameterType.RANGE,
    value: 50,
    min: 0,
    max: 100,
    unit: '%',
  });

  readonly palette = new PaletteParameters();
  readonly easing = new EasingParameters();

  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
      ['easing.', this.easing.parameters],
    ])
  );

  getMaxLitCount(ledCount: number): number {
    return Math.max(1, Math.round(ledCount * (this.coverage.value / 100)));
  }

  /** Milliseconds between successive dot spawns. */
  getMillisPerDot(ledCount: number): number {
    const durationSeconds = ledCount * (this.coverage.value / 100);
    const maxLit = this.getMaxLitCount(ledCount);
    return (durationSeconds * 1000) / maxLit;
  }

  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new RandomDotsClearLogic(this);
}

// ---------------------------------------------------------------------------
// Helper functions (no inheritance)
// ---------------------------------------------------------------------------

interface DotInfo {
  readonly color: RgbFloat;
  readonly birthTimeMs: number;
}

/** Render a set of dots into a fresh buffer, applying fade-in easing. */
function renderDotsToBuffer(
  total: number,
  dots: ReadonlyMap<number, DotInfo>,
  totalTimeMs: number,
  fadeDuration: number,
  easingIn: (t: number) => number
): RgbFloat[] {
  const buffer = createBlackBuffer(total);
  for (const [index, dot] of dots) {
    const age = totalTimeMs - dot.birthTimeMs;
    if (age < fadeDuration) {
      buffer[index] = lerp(BLACK, dot.color, easingIn(age / fadeDuration));
    } else {
      buffer[index] = dot.color;
    }
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Logic (standalone, no base class)
// ---------------------------------------------------------------------------

class RandomDotsClearLogic implements EffectLogic<AnimationMode.Sequence, LedPoint1D> {
  cycleJustCompleted = false;
  private dots = new Map<number, DotInfo>();
  private totalTimeMs = 0;
  private nextSpawnMs = 0;
  private lastLedCount = 0;
  private initialized = false;
  private flash: FlashAnimation | null = null;

  constructor(private readonly config: RandomDotsClearEffect) {}

  private reset(total: number): void {
    this.dots.clear();
    this.totalTimeMs = 0;
    this.nextSpawnMs = 0;
    this.lastLedCount = total;
    this.initialized = true;
    this.flash = null;
  }

  renderGlobal(ctx: EffectContextSequence, _points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;

    if (!this.initialized || this.lastLedCount !== total) {
      this.reset(total);
    }

    this.totalTimeMs += ctx.delta_time_ms;

    // Drive the flash animation when active
    if (this.flash) {
      const result = this.flash.advance(total, ctx.delta_time_ms);
      if (this.flash.finished) {
        this.reset(total);
        this.cycleJustCompleted = true;
      }
      return result;
    }

    this.cycleJustCompleted = false;

    const maxLit = this.config.getMaxLitCount(total);
    const millisPerDot = this.config.getMillisPerDot(total);
    const fadeDuration = millisPerDot;
    const easingFn = this.config.easing.getInEasingFunction();

    // Spawn new dots until coverage is reached
    while (this.totalTimeMs >= this.nextSpawnMs) {
      if (this.dots.size >= maxLit) {
        // Coverage reached — start flash-and-clear
        const buffer = renderDotsToBuffer(total, this.dots, this.totalTimeMs, fadeDuration, easingFn);
        this.flash = new FlashAnimation(buffer);
        return buffer;
      }

      const index = pickRandomFreeIndex(total, this.dots);
      if (index >= 0) {
        this.dots.set(index, {
          color: this.config.palette.palette.nextColor().asRgb(),
          birthTimeMs: this.nextSpawnMs,
        });
      }
      this.nextSpawnMs += millisPerDot;
    }

    return renderDotsToBuffer(total, this.dots, this.totalTimeMs, fadeDuration, easingFn);
  }
}
