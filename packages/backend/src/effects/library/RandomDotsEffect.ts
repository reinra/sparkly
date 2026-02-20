import { type RgbFloat, BLACK } from '../../color/ColorFloat';
import { BooleanEffectParameter, ParameterType } from '../../ParameterTypes';
import { Effect, type LedPoint1D, EffectLogic, type EffectContext } from '../Effect';
import { PaletteParameters } from '../util/Palette';


export class RandomDotsEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly paletteParams: PaletteParameters = new PaletteParameters();
  readonly parameters = this.paletteParams.parameters;
  private readonly coverage = this.parameters.register({
    id: 'coverage',
    name: 'Coverage',
    description: 'Approximate percentage of LEDs lit at once (0.0 - 100.0)%',
    type: ParameterType.RANGE,
    value: 50,
    min: 0,
    max: 100,
    unit: '%',
  });
  readonly clear: BooleanEffectParameter = this.parameters.register({
    id: 'clear',
    name: 'Clear after each cycle',
    description: 'Clear the LED buffer on each cycle',
    type: ParameterType.BOOLEAN,
    value: false,
  });
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
    return ledCount * this.getCoverageMultiplier() / 2;
  }
  getStepCount(ledCount: number): number {
    return ledCount * this.getCoverageMultiplier() + (this.clear.value ? 10 : 0); // 10 extra steps = 5 flashes (on/off pairs)
  }
  getMillisPerStep(ledCount: number): number {
    return this.getLoopDurationSeconds(ledCount) * 1000 / this.getStepCount(ledCount);
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => new RandomDotEffectLogic(this);
}
class RandomDotEffectLogic implements EffectLogic<LedPoint1D> {
  private lastBuffer: RgbFloat[] | null = null;
  private accumulatedMs: number = 0;
  private shuffledIndices: number[] = [];
  private shufflePos: number = 0;
  private litQueue: number[] = []; // FIFO queue of lit LED indices
  private flashing: boolean = false;
  private flashStep: number = 0;
  private flashBuffer: RgbFloat[] | null = null;
  constructor(private readonly config: RandomDotsEffect) { }

  private buildShuffledIndices(count: number): void {
    this.shuffledIndices = Array.from({ length: count }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
    this.shufflePos = 0;
  }

  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    if (this.lastBuffer === null || this.lastBuffer.length !== ctx.total_leds) {
      this.lastBuffer = new Array(ctx.total_leds).fill(BLACK);
      this.accumulatedMs = 0;
      this.litQueue = [];
      this.flashing = false;
      this.flashBuffer = null;
      this.buildShuffledIndices(ctx.total_leds);
    }
    this.accumulatedMs += ctx.delta_time_ms;
    const millisPerStep = this.config.getMillisPerStep(ctx.total_leds);
    if (this.accumulatedMs >= millisPerStep) {
      this.accumulatedMs -= millisPerStep;

      if (this.flashing) {
        // Alternate between black (even) and saved buffer (odd) for 5 flashes
        if (this.flashStep % 2 === 0) {
          this.lastBuffer.fill(BLACK);
        } else {
          for (let i = 0; i < this.flashBuffer!.length; i++) {
            this.lastBuffer[i] = this.flashBuffer![i];
          }
        }
        this.flashStep++;
        if (this.flashStep >= 10) {
          // Flashing complete, start new cycle
          this.flashing = false;
          this.flashBuffer = null;
          this.lastBuffer.fill(BLACK);
          this.litQueue = [];
          this.buildShuffledIndices(ctx.total_leds);
        }
      } else {
        // Re-shuffle once all LEDs have been covered
        if (this.shufflePos >= this.shuffledIndices.length) {
          if (this.config.clear.value) {
            // Enter flash mode: save current buffer and start flashing
            this.flashBuffer = [...this.lastBuffer];
            this.flashing = true;
            this.flashStep = 0;
            this.lastBuffer.fill(BLACK); // First flash step: show black
            this.flashStep++;
          } else {
            this.buildShuffledIndices(ctx.total_leds);
          }
        } else {
          const index = this.shuffledIndices[this.shufflePos++];
          this.lastBuffer[index] = this.config.paletteParams.palette.nextColor().asRgb();
          // Remove previous occurrence to keep queue entries unique
          const prevPos = this.litQueue.indexOf(index);
          if (prevPos !== -1) {
            this.litQueue.splice(prevPos, 1);
          }
          this.litQueue.push(index);
          // Turn off oldest LEDs when exceeding coverage limit (FIFO)
          const maxLit = this.config.getMaxLitCount(ctx.total_leds);
          while (this.litQueue.length > maxLit) {
            const oldIndex = this.litQueue.shift()!;
            this.lastBuffer[oldIndex] = BLACK;
          }
        }
      }
    }
    return this.lastBuffer;
  }
}
