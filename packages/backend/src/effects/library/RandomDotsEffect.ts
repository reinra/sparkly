import { type RgbFloat, BLACK, lerp } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import { BooleanEffectParameter, ParameterType } from '../../ParameterTypes';
import { Effect, type LedPoint1D, EffectLogic, type EffectContext } from '../Effect';
import type { EasingIn, EasingOut } from '../util/Easing';
import { EasingParameters } from '../util/EasingMode';
import { PaletteParameters } from '../util/Palette';


export class RandomDotsEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
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
  readonly clear: BooleanEffectParameter = this.customParams.register({
    id: 'clear',
    name: 'Clear after each cycle',
    description: 'Clear the LED buffer on each cycle',
    type: ParameterType.BOOLEAN,
    value: false,
  });
  readonly palette = new PaletteParameters();
  readonly easing = new EasingParameters();
  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ["custom.", this.customParams],
      ["palette.", this.palette.parameters],
      ["easing.", this.easing.parameters],
    ])
  );
  getName(): string {
    return 'Random Dots';
  }
  getCoverageMultiplier(): number {
    return this.coverage.value / 100;
  }
  getMaxLitCount(ledCount: number): number {
    return Math.max(1, Math.round(ledCount * this.getCoverageMultiplier()));
  }
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount * this.getCoverageMultiplier();
  }
  getStepCount(ledCount: number): number {
    return ledCount * this.getCoverageMultiplier() + (this.clear.value ? 10 : 0); // 10 extra steps = 5 flashes (on/off pairs)
  }
  getMillisPerStep(ledCount: number): number {
    return this.getLoopDurationSeconds(ledCount) * 1000 / this.getStepCount(ledCount);
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => new RandomDotEffectLogic(this);
}
/** Encapsulates the flashing animation state that plays after a complete cycle in "clear" mode. */
class FlashAnimation {
  private step: number = 0;
  private accumulatedMs: number = 0;
  private readonly savedBuffer: RgbFloat[];
  private _finished: boolean = false;

  constructor(savedBuffer: RgbFloat[]) {
    this.savedBuffer = savedBuffer;
  }

  get finished(): boolean {
    return this._finished;
  }

  /** Advances the flash animation by deltaMs and returns the frame to display. */
  advance(total: number, deltaMs: number, millisPerStep: number): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(total).fill(BLACK);
    this.accumulatedMs += deltaMs;
    if (this.accumulatedMs >= millisPerStep) {
      this.accumulatedMs -= millisPerStep;
      this.step++;
    }
    if (this.step >= 10) {
      this._finished = true;
      return buffer;
    }
    if (this.step % 2 === 1) {
      for (let i = 0; i < this.savedBuffer.length; i++) {
        buffer[i] = this.savedBuffer[i];
      }
    }
    return buffer;
  }
}

class RandomDotEffectLogic implements EffectLogic<LedPoint1D> {
  private dots: Dot[] = [];
  private totalTimeMs: number = 0;
  private shuffledIndices: number[] = [];
  private shufflePos: number = 0;
  private nextSpawnMs: number = 0;
  private initialized: boolean = false;
  private lastLedCount: number = 0;
  private flash: FlashAnimation | null = null;
  // Cached per-frame values (set at the start of renderGlobal)
  private fadeDuration: number = 0;
  private easingIn!: EasingIn;
  private easingOut!: EasingOut;

  constructor(private readonly config: RandomDotsEffect) { }

  private buildShuffledIndices(count: number): void {
    this.shuffledIndices = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
    this.shufflePos = 0;
  }

  private reset(total: number): void {
    this.dots = [];
    this.totalTimeMs = 0;
    this.nextSpawnMs = 0;
    this.initialized = true;
    this.lastLedCount = total;
    this.flash = null;
    this.buildShuffledIndices(total);
  }

  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;
    const millisPerStep = this.config.getMillisPerStep(total);
    this.fadeDuration = millisPerStep;
    this.easingIn = this.config.easing.getInEasingFunction();
    this.easingOut = this.config.easing.getOutEasingFunction();

    if (!this.initialized || this.lastLedCount !== total) {
      this.reset(total);
    }

    this.totalTimeMs += ctx.delta_time_ms;

    if (this.flash) {
      const result = this.flash.advance(total, ctx.delta_time_ms, millisPerStep);
      if (this.flash.finished) this.reset(total);
      return result;
    }

    const flashResult = this.spawnPendingDots(total);
    if (flashResult) return flashResult;

    this.enforceCoverageLimit(total);
    this.removeExpiredDots();

    return this.renderDots(total);
  }

  /** Spawns new dots at each step interval. Returns a buffer if entering flash mode, otherwise null. */
  private spawnPendingDots(total: number): RgbFloat[] | null {
    const millisPerStep = this.config.getMillisPerStep(total);

    while (this.totalTimeMs >= this.nextSpawnMs) {
      if (this.shufflePos >= this.shuffledIndices.length) {
        if (this.config.clear.value) {
          return this.enterFlashMode(total);
        } else {
          this.buildShuffledIndices(total);
        }
      }

      if (this.shufflePos < this.shuffledIndices.length) {
        this.spawnDotAtNextIndex();
      }
      this.nextSpawnMs += millisPerStep;
    }

    return null;
  }

  /** Captures current state and enters flash mode (used in "clear after cycle"). */
  private enterFlashMode(total: number): RgbFloat[] {
    this.flash = new FlashAnimation(this.renderDots(total));
    return new Array(total).fill(BLACK);
  }

  /** Spawns a single dot at the next shuffled index, crossfading from any existing dot's color. */
  private spawnDotAtNextIndex(): void {
    const index = this.shuffledIndices[this.shufflePos++];
    let fromColor: RgbFloat = BLACK;
    const existingIdx = this.dots.findIndex(d => d.index === index);
    if (existingIdx !== -1) {
      fromColor = this.computeDotColor(this.dots[existingIdx]);
      this.dots.splice(existingIdx, 1);
    }
    this.dots.push({
      index,
      color: this.config.palette.palette.nextColor().asRgb(),
      fromColor,
      birthTimeMs: this.nextSpawnMs,
      fadeOutStartMs: null,
    });
  }

  /** Marks the oldest active dots for fade-out when exceeding the coverage limit. */
  private enforceCoverageLimit(total: number): void {
    const maxLit = this.config.getMaxLitCount(total);
    const activeDots = this.dots.filter(d => d.fadeOutStartMs === null);
    const excess = activeDots.length - maxLit;
    for (let i = 0; i < excess; i++) {
      activeDots[i].fadeOutStartMs = this.totalTimeMs;
    }
  }

  /** Removes dots that have fully faded out. */
  private removeExpiredDots(): void {
    this.dots = this.dots.filter(d => {
      if (d.fadeOutStartMs !== null) {
        return (this.totalTimeMs - d.fadeOutStartMs) < this.fadeDuration;
      }
      return true;
    });
  }

  /** Computes the current rendered color of a dot based on its lifecycle phase. */
  private computeDotColor(dot: Dot): RgbFloat {
    const age = this.totalTimeMs - dot.birthTimeMs;

    if (dot.fadeOutStartMs !== null) {
      const fadeOutProgress = Math.min(1, (this.totalTimeMs - dot.fadeOutStartMs) / this.fadeDuration);
      const brightness = this.easingOut.easingFunction(1 - fadeOutProgress);
      return brightness > 0 ? lerp(BLACK, dot.color, brightness) : BLACK;
    } else if (age < this.fadeDuration) {
      const t = this.easingIn.easingFunction(age / this.fadeDuration);
      return lerp(dot.fromColor, dot.color, t);
    } else {
      return dot.color;
    }
  }

  /** Renders all active dots into a fresh buffer. */
  private renderDots(total: number): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(total).fill(BLACK);

    for (const dot of this.dots) {
      const color = this.computeDotColor(dot);
      if (color !== BLACK) {
        buffer[dot.index] = color;
      }
    }

    return buffer;
  }
}

/** Tracks a single dot's lifecycle for smooth transitions. */
interface Dot {
  /** LED index in the buffer */
  readonly index: number;
  /** Target color at full brightness */
  readonly color: RgbFloat;
  /** Starting color to transition from (previous dot's color, or BLACK) */
  readonly fromColor: RgbFloat;
  /** Time (totalTimeMs) when this dot was spawned */
  readonly birthTimeMs: number;
  /** Time (totalTimeMs) when fade-out started, null if still active */
  fadeOutStartMs: number | null;
}
