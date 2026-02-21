import { type RgbFloat, BLACK, lerp } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import { ParameterType } from '../../ParameterTypes';
import { AnimationMode, type EffectSequence, type LedPoint1D, EffectLogic, type EffectContextSequence } from '../Effect';
import type { EasingIn, EasingOut } from '../util/Easing';
import { EasingParameters } from '../util/EasingMode';
import { PaletteParameters } from '../util/Palette';


/** Base class for random-dot effects with shared parameters and logic. */
abstract class RandomDotsEffectBase implements EffectSequence<LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
  readonly supportsSeamlessLooping = false;
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
  readonly palette = new PaletteParameters();
  readonly easing = new EasingParameters();
  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ["custom.", this.customParams],
      ["palette.", this.palette.parameters],
      ["easing.", this.easing.parameters],
    ])
  );
  abstract getName(): string;
  abstract getStepCount(ledCount: number): number;
  abstract createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D>;

  getCoverageMultiplier(): number {
    return this.coverage.value / 100;
  }
  getMaxLitCount(ledCount: number): number {
    return Math.max(1, Math.round(ledCount * this.getCoverageMultiplier()));
  }
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount * this.getCoverageMultiplier();
  }
  getMillisPerStep(ledCount: number): number {
    return this.getLoopDurationSeconds(ledCount) * 1000 / this.getStepCount(ledCount);
  }
}

/** Continuous random dots — cycles endlessly without clearing. */
export class RandomDotsEffect extends RandomDotsEffectBase {
  getName(): string {
    return 'Random Dots';
  }
  getStepCount(ledCount: number): number {
    return ledCount * this.getCoverageMultiplier();
  }
  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new RandomDotsLoopLogic(this);
}

/** Random dots with flash-and-clear after each full cycle. */
export class RandomDotsClearEffect extends RandomDotsEffectBase {
  getName(): string {
    return 'Random Dots (Clear)';
  }
  getStepCount(ledCount: number): number {
    return this.getMaxLitCount(ledCount) + 10; // one step per coverage-limited LED + 5 flashes (on/off pairs)
  }
  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new RandomDotsClearLogic(this);
}

// ---------------------------------------------------------------------------
// Shared logic helpers
// ---------------------------------------------------------------------------

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

/** Base logic shared between loop and clear variants. */
abstract class RandomDotsLogicBase implements EffectLogic<AnimationMode.Sequence, LedPoint1D> {
  protected dots: Dot[] = [];
  protected totalTimeMs: number = 0;
  protected shuffledIndices: number[] = [];
  protected shufflePos: number = 0;
  protected nextSpawnMs: number = 0;
  protected initialized: boolean = false;
  protected lastLedCount: number = 0;
  // Cached per-frame values (set at the start of renderGlobal)
  protected fadeDuration: number = 0;
  protected easingIn!: EasingIn;
  protected easingOut!: EasingOut;

  constructor(protected readonly config: RandomDotsEffectBase) { }

  protected buildShuffledIndices(count: number): void {
    this.shuffledIndices = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
    this.shufflePos = 0;
  }

  protected reset(total: number): void {
    this.dots = [];
    this.totalTimeMs = 0;
    this.nextSpawnMs = 0;
    this.initialized = true;
    this.lastLedCount = total;
    this.buildShuffledIndices(total);
  }

  renderGlobal(ctx: EffectContextSequence, points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;
    const millisPerStep = this.config.getMillisPerStep(total);
    this.fadeDuration = millisPerStep;
    this.easingIn = this.config.easing.getInEasingFunction();
    this.easingOut = this.config.easing.getOutEasingFunction();

    if (!this.initialized || this.lastLedCount !== total) {
      this.reset(total);
    }

    this.totalTimeMs += ctx.delta_time_ms;

    const earlyResult = this.handlePreSpawn(ctx, total, millisPerStep);
    if (earlyResult) return earlyResult;

    this.spawnPendingDots(total);
    this.enforceCoverageLimit(total);
    this.removeExpiredDots();

    return this.renderDots(total);
  }

  /** Hook called before spawning — subclasses can intercept (e.g. flash animation). */
  protected handlePreSpawn(_ctx: EffectContextSequence, _total: number, _millisPerStep: number): RgbFloat[] | null {
    return null;
  }

  /** Spawns new dots at each step interval. Calls onCycleComplete when all indices used. */
  protected spawnPendingDots(total: number): void {
    const millisPerStep = this.config.getMillisPerStep(total);

    while (this.totalTimeMs >= this.nextSpawnMs) {
      if (this.shufflePos >= this.shuffledIndices.length) {
        if (this.onCycleComplete(total)) return;
      }

      if (this.shufflePos < this.shuffledIndices.length) {
        this.spawnDotAtNextIndex();
      }
      this.nextSpawnMs += millisPerStep;
    }
  }

  /** Called when all shuffled indices have been used. Return true to break spawning loop. */
  protected abstract onCycleComplete(total: number): boolean;

  /** Spawns a single dot at the next shuffled index, crossfading from any existing dot's color. */
  protected spawnDotAtNextIndex(): void {
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
  protected enforceCoverageLimit(total: number): void {
    const maxLit = this.config.getMaxLitCount(total);
    const activeDots = this.dots.filter(d => d.fadeOutStartMs === null);
    const excess = activeDots.length - maxLit;
    for (let i = 0; i < excess; i++) {
      activeDots[i].fadeOutStartMs = this.totalTimeMs;
    }
  }

  /** Removes dots that have fully faded out. */
  protected removeExpiredDots(): void {
    this.dots = this.dots.filter(d => {
      if (d.fadeOutStartMs !== null) {
        return (this.totalTimeMs - d.fadeOutStartMs) < this.fadeDuration;
      }
      return true;
    });
  }

  /** Computes the current rendered color of a dot based on its lifecycle phase. */
  protected computeDotColor(dot: Dot): RgbFloat {
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
  protected renderDots(total: number): RgbFloat[] {
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

// ---------------------------------------------------------------------------
// Continuous loop variant (no clearing)
// ---------------------------------------------------------------------------

class RandomDotsLoopLogic extends RandomDotsLogicBase {
  protected onCycleComplete(_total: number): boolean {
    this.buildShuffledIndices(this.lastLedCount);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Clear-after-cycle variant (with flash animation)
// ---------------------------------------------------------------------------

/** Encapsulates the flashing animation state that plays after a complete cycle. */
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

class RandomDotsClearLogic extends RandomDotsLogicBase {
  private flash: FlashAnimation | null = null;
  private spawnedCount: number = 0;

  protected override reset(total: number): void {
    super.reset(total);
    this.flash = null;
    this.spawnedCount = 0;
  }

  protected override handlePreSpawn(ctx: EffectContextSequence, total: number, millisPerStep: number): RgbFloat[] | null {
    if (this.flash) {
      const result = this.flash.advance(total, ctx.delta_time_ms, millisPerStep);
      if (this.flash.finished) this.reset(total);
      return result;
    }
    return null;
  }

  /** Spawn dots up to the coverage limit, then flash. */
  protected override spawnPendingDots(total: number): void {
    const millisPerStep = this.config.getMillisPerStep(total);
    const maxLit = this.config.getMaxLitCount(total);

    while (this.totalTimeMs >= this.nextSpawnMs) {
      if (this.spawnedCount >= maxLit) {
        this.flash = new FlashAnimation(this.renderDots(total));
        return;
      }

      if (this.shufflePos < this.shuffledIndices.length) {
        this.spawnDotAtNextIndex();
        this.spawnedCount++;
      }
      this.nextSpawnMs += millisPerStep;
    }
  }

  /** No replacement — each dot is unique in clear mode. */
  protected override spawnDotAtNextIndex(): void {
    const index = this.shuffledIndices[this.shufflePos++];
    this.dots.push({
      index,
      color: this.config.palette.palette.nextColor().asRgb(),
      fromColor: BLACK,
      birthTimeMs: this.nextSpawnMs,
      fadeOutStartMs: null,
    });
  }

  /** Dots stay lit until the flash — no coverage-based fade-out. */
  protected override enforceCoverageLimit(_total: number): void { }

  /** Dots stay lit until the flash — no expiration. */
  protected override removeExpiredDots(): void { }

  protected onCycleComplete(_total: number): boolean {
    return true;
  }
}
