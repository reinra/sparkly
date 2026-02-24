import { type RgbFloat, BLACK } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import { ParameterType } from '../../ParameterTypes';
import {
  AnimationMode,
  type EffectSequence,
  type LedPoint1D,
  type EffectLogic,
  type EffectContextSequence,
} from '../Effect';
import { createBlackBuffer } from '../util/ArrayUtils';
import { FlashAnimation } from '../util/FlashAnimation';
import { PaletteParameters } from '../util/Palette';

// ---------------------------------------------------------------------------
// Effect definition
// ---------------------------------------------------------------------------

/** 1D Tetris — blocks drop through empty space and stack, flash-and-clear when full. */
export class BlocksEffect implements EffectSequence<LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
  readonly pointType: '1D' = '1D';
  readonly isStateful: boolean = true;
  readonly hasCycleReset = true;

  readonly customParams = new EffectParameterStorage();

  private readonly minBlockLength = this.customParams.register({
    id: 'min_block_length',
    name: 'Min block length',
    description: 'Minimum number of LEDs in a block',
    type: ParameterType.RANGE,
    value: 2,
    min: 1,
    max: 50,
    step: 1,
  });

  private readonly maxBlockLength = this.customParams.register({
    id: 'max_block_length',
    name: 'Max block length',
    description: 'Maximum number of LEDs in a block',
    type: ParameterType.RANGE,
    value: 10,
    min: 1,
    max: 50,
    step: 1,
  });

  readonly palette = new PaletteParameters();

  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
    ])
  );

  getName(): string {
    return 'Blocks';
  }

  getMinBlockLength(): number {
    return Math.max(1, Math.round(this.minBlockLength.value));
  }

  getMaxBlockLength(): number {
    return Math.max(this.getMinBlockLength(), Math.round(this.maxBlockLength.value));
  }

  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new BlocksLogic(this);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Block {
  /** Color of every LED in this block */
  readonly color: RgbFloat;
  /** Number of LEDs in this block */
  readonly length: number;
  /** Current head position (the leading edge, moves toward 0).
   *  While falling this decreases each step; once landed it is the
   *  final resting position of the block's leading LED. */
  headPosition: number;
  /** True once the block has come to rest. */
  landed: boolean;
}

// ---------------------------------------------------------------------------
// Logic
// ---------------------------------------------------------------------------

/** Speed: one LED position per step, in milliseconds. */
const BASE_MS_PER_STEP = 30;

class BlocksLogic implements EffectLogic<AnimationMode.Sequence, LedPoint1D> {
  cycleJustCompleted = false;
  private total: number = 0;
  private initialized: boolean = false;

  /** The static "floor" buffer — landed blocks are baked in here. */
  private floor: RgbFloat[] = [];
  /** Index of the first free LED (growing from the end toward 0). */
  private floorLevel: number = 0;

  /** The currently falling block (null while flash is running or before first spawn). */
  private activeBlock: Block | null = null;

  /** Flash animation played when the strip is full. */
  private flash: FlashAnimation | null = null;

  /** Timing accumulator. */
  private accumulatedMs: number = 0;

  constructor(private readonly config: BlocksEffect) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  renderGlobal(ctx: EffectContextSequence, _points: LedPoint1D[]): RgbFloat[] {
    const total = ctx.total_leds;

    if (!this.initialized || this.total !== total) {
      this.reset(total);
    }

    // --- Flash phase ---
    if (this.flash) {
      const result = this.flash.advance(total, ctx.delta_time_ms);
      if (this.flash.finished) {
        this.reset(total);
        this.cycleJustCompleted = true;
      }
      return result;
    }

    this.cycleJustCompleted = false;

    // --- Spawn a new block if needed ---
    if (!this.activeBlock) {
      this.activeBlock = this.spawnBlock(total);
      if (!this.activeBlock) {
        // No room at all – trigger flash immediately
        this.flash = new FlashAnimation([...this.floor]);
        return this.renderFrame(total);
      }
    }

    // --- Advance falling ---
    this.accumulatedMs += ctx.delta_time_ms;
    while (this.accumulatedMs >= BASE_MS_PER_STEP) {
      this.accumulatedMs -= BASE_MS_PER_STEP;
      this.step(total);
      if (this.flash) break; // flash was triggered during stepping
    }

    return this.renderFrame(total);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private reset(total: number): void {
    this.total = total;
    this.initialized = true;
    this.floor = createBlackBuffer(total);
    this.floorLevel = total; // entirely empty — next landing position is at end
    this.activeBlock = null;
    this.flash = null;
    this.accumulatedMs = 0;
  }

  /** Create a new block at the top (position 0). Returns null if there is no room. */
  private spawnBlock(total: number): Block | null {
    const minLen = this.config.getMinBlockLength();
    const maxLen = this.config.getMaxBlockLength();
    const length = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));

    // Available empty space
    const freeSpace = this.floorLevel;
    if (freeSpace < 1) return null; // completely full

    // Clamp block length to available space
    const clampedLength = Math.min(length, freeSpace);

    return {
      color: this.config.palette.palette.nextColor().asRgb(),
      length: clampedLength,
      headPosition: 0, // starts at the very top
      landed: false,
    };
  }

  /** Advance one discrete step: move the active block down by 1 LED. */
  private step(total: number): void {
    if (!this.activeBlock || this.activeBlock.landed) {
      this.landCurrentBlock(total);
      return;
    }

    const block = this.activeBlock;
    const blockEnd = block.headPosition + block.length; // one past last occupied LED

    // Can we move one step further?
    if (blockEnd < this.floorLevel) {
      block.headPosition++;
    } else {
      // Landed
      block.landed = true;
      this.landCurrentBlock(total);
    }
  }

  /** Bake the active block into the floor and prepare for the next one. */
  private landCurrentBlock(total: number): void {
    if (this.activeBlock) {
      const block = this.activeBlock;
      for (let i = 0; i < block.length; i++) {
        const pos = block.headPosition + i;
        if (pos >= 0 && pos < total) {
          this.floor[pos] = block.color;
        }
      }
      this.floorLevel = block.headPosition; // new floor starts where the block's head is
      this.activeBlock = null;
    }

    // Check if full — trigger flash if no room for even 1 LED
    if (this.floorLevel <= 0) {
      this.flash = new FlashAnimation([...this.floor]);
      return;
    }

    // Spawn next block immediately
    this.activeBlock = this.spawnBlock(total);
    if (!this.activeBlock) {
      this.flash = new FlashAnimation([...this.floor]);
    }
  }

  /** Compose the current frame: floor + falling block. */
  private renderFrame(total: number): RgbFloat[] {
    const buffer = [...this.floor];

    if (this.activeBlock && !this.activeBlock.landed) {
      const block = this.activeBlock;
      for (let i = 0; i < block.length; i++) {
        const pos = block.headPosition + i;
        if (pos >= 0 && pos < total) {
          buffer[pos] = block.color;
        }
      }
    }

    return buffer;
  }
}
