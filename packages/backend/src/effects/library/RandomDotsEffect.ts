import { type RgbFloat, BLACK } from '../../color/ColorFloat';
import { BooleanEffectParameter, ParameterType } from '../../ParameterTypes';
import { Effect, type LedPoint1D, EffectLogic, type EffectContext } from '../Effect';
import { PaletteParameters } from '../util/Palette';


export class RandomDotsEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly paletteParams: PaletteParameters = new PaletteParameters();
  readonly parameters = this.paletteParams.parameters;
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
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount / 2;
  }
  getStepCount(ledCount: number): number {
    return ledCount + (this.clear.value ? 1 : 0); // We control timing manually in the logic
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
      this.buildShuffledIndices(ctx.total_leds);
    }
    this.accumulatedMs += ctx.delta_time_ms;
    const millisPerStep = this.config.getMillisPerStep(ctx.total_leds);
    let skipNextColor = false;
    if (this.accumulatedMs >= millisPerStep) {
      this.accumulatedMs -= millisPerStep;
      // Re-shuffle once all LEDs have been covered
      if (this.shufflePos >= this.shuffledIndices.length) {
        this.buildShuffledIndices(ctx.total_leds);
        if (this.config.clear.value) {
          this.lastBuffer.fill(BLACK);
          skipNextColor = true; // Skip lighting a new LED on the same frame we clear to avoid a flash of color
        }
      }
      if (!skipNextColor) {
        const index = this.shuffledIndices[this.shufflePos++];
        this.lastBuffer[index] = this.config.paletteParams.palette.nextColor().asRgb();
      }
    }
    return this.lastBuffer;
  }
}
