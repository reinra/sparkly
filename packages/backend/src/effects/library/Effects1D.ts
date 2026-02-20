import { createPresetFactoryForSingleParameter } from '../../EffectWrapper';
import { BooleanEffectParameter, ParameterType } from '../../ParameterTypes';
import { BLACK, lerp, WHITE, type RgbFloat } from '../../color/ColorFloat';
import {
  BLACK_HSL_COLOR,
  BLUE_HSL_COLOR,
  DEFAULT_HSL_COLOR,
  GREEN_HSL_COLOR,
  hslToRgbFloat,
  lerpHsl,
  multiplyIntensity,
  randomColorMaxSaturation,
  RED_HSL_COLOR,
  WHITE_HSL_COLOR,
  YELLOW_HSL_COLOR,
} from '../../color/Hsl';
import { EffectParameterStorage, EffectParameterView } from '../../effectParameters';
import {
  BaseSameColorEffect,
  type StatelessEffect,
  type EffectContext,
  type LedPoint1D,
  PerPixelEffect,
  EffectLogic,
  Effect,
  LedPointType,
  EffectPreset,
} from '../Effect';
import { PaletteParameters } from '../util/Palette';
import { backAndForthPhaseWithPause } from '../util/PhaseUtis';

export class SingleHslColorEffect extends BaseSameColorEffect {
  readonly isStatic = true;
  readonly parameters = new EffectParameterStorage();
  private readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: DEFAULT_HSL_COLOR,
  });
  getName(): string {
    return 'Single Color';
  }
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.color.id);
    return [
      factory('red', 'Single Color: Red', RED_HSL_COLOR),
      factory('green', 'Single Color: Green', GREEN_HSL_COLOR),
      factory('blue', 'Single Color: Blue', BLUE_HSL_COLOR),
      factory('white', 'Single Color: White', WHITE_HSL_COLOR),
      factory('black', 'Single Color: Black', BLACK_HSL_COLOR),
      factory('choose_hsl', 'Single Color: Custom', DEFAULT_HSL_COLOR),
    ];
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0;
  }
  renderColor(ctx: EffectContext): RgbFloat {
    return hslToRgbFloat(this.color.value);
  }
}

export class FlipColorCustomEffect extends BaseSameColorEffect {
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('flip_rgb', 'Flip RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('flip_rgby', 'Flip RGBY', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR, YELLOW_HSL_COLOR]),
    ];
  }
  getName(): string {
    return 'Flip Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return this.colors.value.length * 2;
  }
  renderColor(ctx: EffectContext): RgbFloat {
    const totalColors = this.colors.value.length;
    const index = Math.floor(ctx.phase * totalColors) % totalColors;
    return hslToRgbFloat(this.colors.value[index]);
  }
}

export class ChangeColorEffect extends BaseSameColorEffect {
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('change_color_rgb', 'Change Color: RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('change_color_rgby', 'Change Color: RGBY', [
        RED_HSL_COLOR,
        GREEN_HSL_COLOR,
        BLUE_HSL_COLOR,
        YELLOW_HSL_COLOR,
      ]),
    ];
  }
  getName(): string {
    return 'Change Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return this.colors.value.length * 2;
  }
  renderColor(ctx: EffectContext): RgbFloat {
    const totalColors = this.colors.value.length;
    const colorPhase = (ctx.phase * totalColors) % totalColors;
    const fromIndex = Math.floor(colorPhase);
    const toIndex = (fromIndex + 1) % totalColors;
    const t = colorPhase - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class StaticAlternatingColorEffect extends PerPixelEffect<LedPoint1D> {
  readonly isStatic = true;
  pointType: LedPointType = '1D';
  constructor(private readonly colors: RgbFloat[]) {
    super();
  }
  getName(): string {
    return 'Static Alternating Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    const index = point.position % this.colors.length;
    return this.colors[index];
  }
}

export class StaticAlternatingColorCustomEffect extends PerPixelEffect<LedPoint1D> {
  readonly isStatic = true;
  pointType: LedPointType = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('alternate_rgb', 'Alternate RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('alternate_rgby', 'Alternate RGBY', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR, YELLOW_HSL_COLOR]),
      factory('alternate_wb', 'Alternate WB', [WHITE_HSL_COLOR, BLACK_HSL_COLOR]),
    ];
  }
  getName(): string {
    return 'Static Alternating Colors';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    const index = point.position % this.colors.value.length;
    return hslToRgbFloat(this.colors.value[index]);
  }
}

export class StaticColorGradientEffect extends PerPixelEffect<LedPoint1D> {
  readonly isStatic = true;
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values for the gradient',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR],
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('gradient_red_yellow', 'Gradient: Red-Yellow', [RED_HSL_COLOR, YELLOW_HSL_COLOR]),
      factory('gradient_rgb', 'Gradient: RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('gradient_rgbr', 'Gradient: RGBR', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR, RED_HSL_COLOR]),
      factory('gradient_black_red', 'Gradient: Black-Red', [BLACK_HSL_COLOR, RED_HSL_COLOR]),
      factory('gradient_black_green', 'Gradient: Black-Green', [BLACK_HSL_COLOR, GREEN_HSL_COLOR]),
      factory('gradient_black_blue', 'Gradient: Black-Blue', [BLACK_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('gradient_black_white', 'Gradient: Black-White', [BLACK_HSL_COLOR, WHITE_HSL_COLOR]),
    ];
  }
  getName(): string {
    return 'Static Color Gradient';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0; // Static effect has no loop
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = point.distance * (this.colors.value.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.value.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class StaticCustomColorGradientEffect extends PerPixelEffect<LedPoint1D> {
  readonly isStatic = true;
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly color1 = this.parameters.register({
    id: 'color1',
    name: 'Color 1',
    description: 'HSL color value for the first color',
    type: ParameterType.HSL,
    value: RED_HSL_COLOR,
  });
  private readonly color2 = this.parameters.register({
    id: 'color2',
    name: 'Color 2',
    description: 'HSL color value for the second color',
    type: ParameterType.HSL,
    value: BLUE_HSL_COLOR,
  });
  getName(): string {
    return `Static Custom Color Gradient`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0; // Static effect has no loop
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    return hslToRgbFloat(lerpHsl(this.color1.value, this.color2.value, point.distance));
  }
}

export class RotatingColorGradientEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values for the gradient',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR, RED_HSL_COLOR],
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('rotating_gradient_rgbr', 'Rotating Gradient: RGBR', [
        RED_HSL_COLOR,
        GREEN_HSL_COLOR,
        BLUE_HSL_COLOR,
        RED_HSL_COLOR,
      ]),
      factory('rotating_gradient_rgb', 'Rotating Gradient: RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
    ];
  }
  getName(): string {
    return 'Rotating Color Gradient';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5; // Rotating effect has a loop duration
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = ((point.distance + ctx.phase) % 1.0) * (this.colors.value.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.value.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class AlternatingCustomColorFadingEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly colors = this.parameters.register({
    id: 'colors',
    name: 'Colors',
    description: 'HSL color values for the alternating colors',
    type: ParameterType.MULTI_HSL,
    value: [RED_HSL_COLOR, BLUE_HSL_COLOR],
  });
  private readonly colorBg = this.parameters.register({
    id: 'colorBg',
    name: 'Background Color',
    description: 'HSL color value for the background color',
    type: ParameterType.HSL,
    value: BLACK_HSL_COLOR,
  });
  getPresets(): EffectPreset[] {
    const factory = createPresetFactoryForSingleParameter(this.colors.id);
    return [
      factory('alternating_rb', 'Alternating Fading: Red-Blue', [RED_HSL_COLOR, BLUE_HSL_COLOR]),
      factory('alternating_rgb', 'Alternating Fading: RGB', [RED_HSL_COLOR, GREEN_HSL_COLOR, BLUE_HSL_COLOR]),
    ];
  }
  getName(): string {
    return 'Alternating Colors Fading';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    const totalColors = this.colors.value.length;
    const index = point.position % totalColors;
    // Divide phase into N segments, one per color — only the active color's LEDs light up
    const activeIndex = Math.floor(ctx.phase * totalColors);
    if (index !== activeIndex) {
      return hslToRgbFloat(this.colorBg.value);
    }
    const segmentPhase = (ctx.phase * totalColors) % 1.0;
    const fadeFactor = backAndForthPhaseWithPause(segmentPhase);
    const color = this.colors.value[index];
    return hslToRgbFloat(lerpHsl(this.colorBg.value, color, fadeFactor));
  }
}

// Also called "Marquee" if it runs a bit faster
export class TestPerLedEffect implements StatelessEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: false = false;
  getName(): string {
    return 'Test Per-Led 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount / 2;
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    const result: RgbFloat[] = new Array(points.length).fill(BLACK);
    const index = Math.floor(ctx.phase * points.length);
    result[index] = WHITE;
    return result;
  }
}

// Also called "Marquee" if it runs a bit faster
export class TestAllLedsFlash implements StatelessEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: false = false;
  getName(): string {
    return 'Test All LEDs Flash';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 1;
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    const color = ctx.frame_index % 2 === 0 ? WHITE : BLACK;
    return new Array(points.length).fill(color);
  }
}

export class RainbowGradientEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  getName(): string {
    return 'Rainbow Gradient 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.distance) % 1.0;
    return hslToRgbFloat({ hue, saturation: 1, lightness: 0.5 });
  }
}

export class MeteorEffect implements Effect<LedPoint1D> {
  parameters?: EffectParameterView | undefined;
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  getName(): string {
    return 'Meteor';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => new MeteorEffectLogic();
}

class MeteorEffectLogic implements EffectLogic<LedPoint1D> {
  private lastBuffer: RgbFloat[] | null = null;
  private previousHeadIndex: number = -1;
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    // 1. Fade the whole buffer slightly (creates the trail)
    // The fade amount is scaled by deltaTime to keep it FPS-independent
    const fadeFactor = 1.0 - ctx.delta_time_ms / 500; // Lose full brightness every 500ms

    if (this.lastBuffer === null || this.lastBuffer.length !== ctx.total_leds) {
      this.lastBuffer = new Array(ctx.total_leds).fill(BLACK);
      this.previousHeadIndex = -1;
    } else {
      for (let i = 0; i < this.lastBuffer.length; i++) {
        this.lastBuffer[i] = lerp(BLACK, this.lastBuffer[i], fadeFactor);
      }
    }

    // 2. Draw the "Head" of the meteor, filling gaps if running fast
    const headIndex = Math.floor(ctx.phase * ctx.total_leds);

    // Fill all LEDs from previous position to current position to avoid gaps
    // But detect wrapping (when headIndex jumps back to start)
    if (this.previousHeadIndex >= 0 && headIndex >= this.previousHeadIndex) {
      // Normal forward movement - fill the gap
      for (let i = this.previousHeadIndex; i <= headIndex && i < this.lastBuffer.length; i++) {
        this.lastBuffer[i] = WHITE;
      }
    } else if (headIndex < this.lastBuffer.length) {
      // Wrapped around or first frame - just set current position
      this.lastBuffer[headIndex] = WHITE;
    }

    this.previousHeadIndex = headIndex;

    return this.lastBuffer;
  }
}

export abstract class BaseRainEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly parameters = new EffectParameterStorage();
  readonly probability = this.parameters.register({
    id: 'probability',
    name: 'Chance of new particle',
    description: 'Chance for a new raindrop particle to spawn on each frame (0.0 - 100.0)%',
    type: ParameterType.RANGE,
    value: 50,
    min: 0,
    max: 100,
    unit: '%',
  });
  abstract getName(): string;
  getLoopDurationSeconds(ledCount: number): number {
    return 60;
  }
  createLogic: () => EffectLogic<LedPoint1D> = () => new RainEffectLogic(this);
  abstract nextColor(): RgbFloat;
}

export class SingleColorRainEffect extends BaseRainEffect {
  readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: BLUE_HSL_COLOR,
  });
  getName(): string {
    return 'Single-Color Rain';
  }
  nextColor(): RgbFloat {
    return hslToRgbFloat(this.color.value);
  }
}

export class MultiColorRainEffect extends BaseRainEffect {
  getName(): string {
    return 'Multi-Color Rain';
  }
  nextColor(): RgbFloat {
    return hslToRgbFloat(randomColorMaxSaturation());
  }
}

interface Particle {
  position: number;
  velocity: number;
  color: RgbFloat;
}
class RainEffectLogic implements EffectLogic<LedPoint1D> {
  private particles: Particle[] = [];
  constructor(private readonly config: BaseRainEffect) {}
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    // 1. Move existing particles based on velocity and time passed
    this.particles.forEach((p) => {
      p.position += (p.velocity * ctx.delta_time_ms) / 1000;
    });

    // 2. Remove off-screen particles
    this.particles = this.particles.filter((p) => p.position < ctx.total_leds);

    // 3. Add new particles "randomly" using a Seeded PRNG
    if (Math.random() < this.config.probability.value / 100) {
      this.particles.push({ position: 0, velocity: Math.random() * 10, color: this.config.nextColor() });
    }

    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);

    // Draw particles
    for (const p of this.particles) {
      const idx = Math.floor(p.position);
      if (idx >= 0 && idx < buffer.length) {
        const previous = buffer[idx];
        buffer[idx] = previous === BLACK ? p.color : lerp(previous, p.color, 0.5); // Blend with existing color for a nicer look
      }
    }
    return buffer;
  }
}

export class TwinkleEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly probability = this.parameters.register({
    id: 'twinkle_probability',
    name: 'Twinkle Probability',
    description: 'Chance for each LED to twinkle on each frame (0.0 - 1.0)',
    type: ParameterType.RANGE,
    value: 1,
    min: 0,
    max: 100,
    unit: '%',
  });
  private readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: WHITE_HSL_COLOR,
  });
  getName(): string {
    return 'Twinkle';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 1;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    if (Math.random() < this.probability.value / 100) {
      return hslToRgbFloat(this.color.value);
    }
    return BLACK;
  }
}

export class SineEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly frequency = this.parameters.register({
    id: 'sine_frequency',
    name: 'Sine Frequency',
    description: 'Frequency of the sine wave (cycles per LED)',
    type: ParameterType.RANGE,
    value: 3,
    min: 1,
    max: 10,
  });
  private readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: { hue: 0.1, saturation: 1.0, lightness: 0.5 },
  });
  getName(): string {
    return `Sine Wave`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // We combine spatial position (pt.distance) with temporal progress (ctx.phase)
    const wave = Math.sin((point.distance * this.frequency.value + ctx.phase) * Math.PI * 2);

    // Map wave (-1 to 1) to brightness (0 to 1)
    const brightness = (wave + 1) / 2;

    // Use HSL to keep a consistent color but vary the lightness
    return hslToRgbFloat({ ...this.color.value, lightness: this.color.value.lightness * brightness });
  }
}

export class PingPongEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  readonly parameters = new EffectParameterStorage();
  private readonly color1 = this.parameters.register({
    id: 'color1',
    name: 'Forward color',
    description: 'HSL color value for the first color',
    type: ParameterType.HSL,
    value: { hue: 0.6, saturation: 1.0, lightness: 0.5 },
  });
  private readonly color2 = this.parameters.register({
    id: 'color2',
    name: 'Backward color',
    description: 'HSL color value for the second color',
    type: ParameterType.HSL,
    value: { hue: 0.0, saturation: 1.0, lightness: 0.5 },
  });
  getName(): string {
    return 'Ping Pong';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbFloat {
    // Convert 0...1 phase into 0...1...0 bounce
    const bounce = 1.0 - Math.abs(ctx.phase * 2 - 1);

    const pulseWidth = 0.1;

    // Calculate distance from LED to the current bounce position
    const dist = Math.abs(point.distance - bounce);

    // Create a sharp pulse with soft edges
    const intensity = Math.max(0, 1.0 - dist / pulseWidth);

    // Shift hue based on direction
    const color = ctx.phase < 0.5 ? this.color1.value : this.color2.value;

    return hslToRgbFloat(multiplyIntensity(color, intensity));
  }
}

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
  constructor(private readonly config: RandomDotsEffect) {}

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
