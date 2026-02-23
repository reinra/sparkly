import { type RgbFloat, BLACK, lerp } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import { ParameterType } from '../../ParameterTypes';
import { AnimationMode, type EffectLoop, type EffectContextLoop, type LedPoint1D, type EffectLogic } from '../Effect';
import { EasingParameters } from '../util/EasingMode';
import { PaletteParameters } from '../util/Palette';

/** Number of snapshots (and transition segments) per loop. */
const SEGMENT_COUNT = 2;

/**
 * Phase-based random dots that loops seamlessly.
 * Pre-generates SEGMENT_COUNT random snapshots and crossfades between them.
 * The last segment transitions back to the first snapshot, ensuring a seamless loop.
 */
export class RandomDotsNewLoopEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '1D' = '1D';
  isStateful: boolean = true;

  readonly customParams = new EffectParameterStorage();
  private readonly coverage = this.customParams.register({
    id: 'coverage',
    name: 'Coverage',
    description: 'Approximate percentage of LEDs lit (0.0 - 100.0)%',
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

  getName(): string {
    return 'Random Dots (Loop)';
  }

  getLoopDurationSeconds(ledCount: number): number {
    return ledCount / 2;
  }

  getMaxLitCount(ledCount: number): number {
    return Math.max(1, Math.round(ledCount * (this.coverage.value / 100)));
  }

  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => new RandomDotsNewLoopLogic(this);
}

/** Pre-computed transition info for one segment. */
interface SegmentTransition {
  /** LED indices that change between snapshots, in shuffled order. */
  readonly indices: number[];
  /** From-color for each changing LED (parallel to indices). */
  readonly fromColors: RgbFloat[];
  /** To-color for each changing LED (parallel to indices). */
  readonly toColors: RgbFloat[];
}

class RandomDotsNewLoopLogic implements EffectLogic<AnimationMode.Loop, LedPoint1D> {
  private snapshots: RgbFloat[][] = [];
  private transitions: SegmentTransition[] = [];
  private initialized = false;
  private lastLedCount = 0;

  constructor(private readonly config: RandomDotsNewLoopEffect) {}

  private generateSnapshot(total: number): RgbFloat[] {
    const litCount = this.config.getMaxLitCount(total);
    const buffer: RgbFloat[] = new Array(total).fill(BLACK);

    // Fisher-Yates shuffle to pick random LED positions
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let i = 0; i < litCount; i++) {
      buffer[indices[i]] = this.config.palette.palette.nextColor().asRgb();
    }

    return buffer;
  }

  /** Build a shuffled list of LED indices that differ between two snapshots. */
  private buildTransition(from: RgbFloat[], to: RgbFloat[]): SegmentTransition {
    const indices: number[] = [];
    const fromColors: RgbFloat[] = [];
    const toColors: RgbFloat[] = [];

    for (let i = 0; i < from.length; i++) {
      if (from[i] !== to[i]) {
        indices.push(i);
        fromColors.push(from[i]);
        toColors.push(to[i]);
      }
    }

    // Shuffle the change order
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      [fromColors[i], fromColors[j]] = [fromColors[j], fromColors[i]];
      [toColors[i], toColors[j]] = [toColors[j], toColors[i]];
    }

    return { indices, fromColors, toColors };
  }

  private initialize(total: number): void {
    this.snapshots = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      this.snapshots.push(this.generateSnapshot(total));
    }

    this.transitions = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      this.transitions.push(this.buildTransition(this.snapshots[i], this.snapshots[(i + 1) % SEGMENT_COUNT]));
    }

    this.initialized = true;
    this.lastLedCount = total;
  }

  renderGlobal(ctx: EffectContextLoop, _points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;
    if (!this.initialized || this.lastLedCount !== total) {
      this.initialize(total);
    }

    // Determine which segment we're in and the progress within it
    const segPhase = ctx.phase * SEGMENT_COUNT;
    const segIndex = Math.min(Math.floor(segPhase), SEGMENT_COUNT - 1);
    const progress = segPhase - segIndex;

    // Start from the "from" snapshot
    const from = this.snapshots[segIndex];
    const buffer: RgbFloat[] = from.slice();

    const transition = this.transitions[segIndex];
    const changeCount = transition.indices.length;
    if (changeCount === 0) return buffer;

    const easingIn = this.config.easing.getInEasingFunction();
    const easingOut = this.config.easing.getOutEasingFunction();

    // Each LED gets an equal window within the segment to transition
    const scaledProgress = progress * changeCount;
    const currentLedIdx = Math.min(Math.floor(scaledProgress), changeCount - 1);
    const ledProgress = scaledProgress - currentLedIdx;

    // LEDs before current: already fully transitioned to target
    for (let i = 0; i < currentLedIdx; i++) {
      buffer[transition.indices[i]] = transition.toColors[i];
    }

    // Current LED: transitioning with easing
    {
      const idx = transition.indices[currentLedIdx];
      const fromColor = transition.fromColors[currentLedIdx];
      const toColor = transition.toColors[currentLedIdx];

      if (fromColor === BLACK) {
        const t = easingIn.easingFunction(ledProgress);
        buffer[idx] = lerp(BLACK, toColor, t);
      } else if (toColor === BLACK) {
        const brightness = easingOut.easingFunction(1 - ledProgress);
        buffer[idx] = brightness > 0 ? lerp(BLACK, fromColor, brightness) : BLACK;
      } else {
        const t = easingIn.easingFunction(ledProgress);
        buffer[idx] = lerp(fromColor, toColor, t);
      }
    }

    // LEDs after current: still at from-color (already in buffer from slice)

    return buffer;
  }
}
