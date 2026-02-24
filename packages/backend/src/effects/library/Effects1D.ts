import { createPresetFactoryForSingleParameter } from '../../EffectWrapper';
import { ParameterType } from '../../ParameterTypes';
import { BLACK, lerp, WHITE, type RgbFloat } from '../../color/ColorFloat';
import {
  BLACK_HSL_COLOR,
  BLUE_HSL_COLOR,
  DEFAULT_HSL_COLOR,
  GREEN_HSL_COLOR,
  hslToRgbFloat,
  lerpHsl,
  multiplyIntensity,
  RED_HSL_COLOR,
  WHITE_HSL_COLOR,
  YELLOW_HSL_COLOR,
} from '../../color/Hsl';
import { EffectParameterStorage, type EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import {
  AnimationMode,
  type EffectContextStatic,
  type EffectContextLoop,
  type EffectContextSequence,
  type EffectLoop,
  type LedPoint1D,
  EffectLogic,
  LedPointType,
  EffectPreset,
} from '../Effect';
import { BaseSameColorEffect, PerPixelEffect, type StatelessEffect } from '../BaseEffects';
import { backAndForthPhaseWithPause } from '../util/PhaseUtis';
import { PaletteParameters } from '../util/Palette';

export class StaticSingleColorEffect extends BaseSameColorEffect<AnimationMode.Static> {
  readonly animationMode = AnimationMode.Static;
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
  renderColor(ctx: EffectContextStatic): RgbFloat {
    return hslToRgbFloat(this.color.value);
  }
}

export class FlipColorCustomEffect extends BaseSameColorEffect<AnimationMode.Loop> {
  readonly animationMode = AnimationMode.Loop;
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
  renderColor(ctx: EffectContextLoop): RgbFloat {
    const totalColors = this.colors.value.length;
    const index = Math.floor(ctx.phase * totalColors) % totalColors;
    return hslToRgbFloat(this.colors.value[index]);
  }
}

export class ChangeColorEffect extends BaseSameColorEffect<AnimationMode.Loop> {
  readonly animationMode = AnimationMode.Loop;
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
  renderColor(ctx: EffectContextLoop): RgbFloat {
    const totalColors = this.colors.value.length;
    const colorPhase = (ctx.phase * totalColors) % totalColors;
    const fromIndex = Math.floor(colorPhase);
    const toIndex = (fromIndex + 1) % totalColors;
    const t = colorPhase - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class StaticAlternatingColorEffect extends PerPixelEffect<AnimationMode.Static, LedPoint1D> {
  readonly animationMode = AnimationMode.Static;
  pointType: LedPointType = '1D';
  constructor(private readonly colors: RgbFloat[]) {
    super();
  }
  getName(): string {
    return 'Static Alternating Color';
  }
  renderPixel(ctx: EffectContextStatic, point: LedPoint1D): RgbFloat {
    const index = point.position % this.colors.length;
    return this.colors[index];
  }
}

export class StaticAlternatingColorCustomEffect extends PerPixelEffect<AnimationMode.Static, LedPoint1D> {
  readonly animationMode = AnimationMode.Static;
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
  renderPixel(ctx: EffectContextStatic, point: LedPoint1D): RgbFloat {
    const index = point.position % this.colors.value.length;
    return hslToRgbFloat(this.colors.value[index]);
  }
}

export class StaticColorGradientEffect extends PerPixelEffect<AnimationMode.Static, LedPoint1D> {
  readonly animationMode = AnimationMode.Static;
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
  renderPixel(ctx: EffectContextStatic, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = point.distance * (this.colors.value.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.value.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class StaticCustomColorGradientEffect extends PerPixelEffect<AnimationMode.Static, LedPoint1D> {
  readonly animationMode = AnimationMode.Static;
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
  renderPixel(ctx: EffectContextStatic, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    return hslToRgbFloat(lerpHsl(this.color1.value, this.color2.value, point.distance));
  }
}

export class RotatingColorGradientEffect extends PerPixelEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
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
  renderPixel(ctx: EffectContextLoop, point: LedPoint1D): RgbFloat {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = ((point.distance + ctx.phase) % 1.0) * (this.colors.value.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.value.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(hslToRgbFloat(this.colors.value[fromIndex]), hslToRgbFloat(this.colors.value[toIndex]), t);
  }
}

export class AlternatingCustomColorFadingEffect extends PerPixelEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
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
  renderPixel(ctx: EffectContextLoop, point: LedPoint1D): RgbFloat {
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
export class TestPerLedEffect implements StatelessEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '1D' = '1D';
  isStateful: false = false;
  getName(): string {
    return 'Test Per-Led 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount / 2;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => this;
  renderGlobal(ctx: EffectContextLoop, points: LedPoint1D[]): RgbFloat[] {
    const result: RgbFloat[] = new Array(points.length).fill(BLACK);
    const index = Math.floor(ctx.phase * points.length);
    result[index] = WHITE;
    return result;
  }
}

// Also called "Marquee" if it runs a bit faster
export class TestAllLedsFlash implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  getName(): string {
    return 'Test All LEDs Flash';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 1;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => new TestAllLedsFlashLogic();
}

class TestAllLedsFlashLogic implements EffectLogic<AnimationMode.Loop, LedPoint1D> {
  private isOn: boolean = true;

  renderGlobal(ctx: EffectContextLoop, points: LedPoint1D[]): RgbFloat[] {
    const color = this.isOn ? WHITE : BLACK;
    this.isOn = !this.isOn;
    return new Array(points.length).fill(color);
  }
}

export class RainbowGradientEffect extends PerPixelEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '1D' = '1D';
  getName(): string {
    return 'Rainbow Gradient 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContextLoop, point: LedPoint1D): RgbFloat {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.distance) % 1.0;
    return hslToRgbFloat({ hue, saturation: 1, lightness: 0.5 });
  }
}

export class MeteorEffect implements EffectLoop<LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
  readonly customParams = new EffectParameterStorage();
  readonly fadeFactor = this.customParams.register({
    id: 'fade_factor',
    name: 'Fade Speed',
    description: 'How quickly the meteor trail fades (higher = faster fade)',
    type: ParameterType.RANGE,
    value: 10,
    min: 1,
    max: 50,
  });
  readonly palette = new PaletteParameters();
  public readonly parameters: EffectParameterView = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
    ])
  );
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  getName(): string {
    return 'Meteor';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint1D> = () => new MeteorEffectLogic(this);
}

class MeteorEffectLogic implements EffectLogic<AnimationMode.Loop, LedPoint1D> {
  private lastBuffer: RgbFloat[] | null = null;
  private previousPhase: number = -1;
  private previousHeadIndex: number = -1;
  private currentColor: RgbFloat;

  constructor(private readonly config: MeteorEffect) {
    this.currentColor = config.palette.palette.nextColor().asRgb();
  }

  renderGlobal(ctx: EffectContextLoop, points: LedPoint1D[]): RgbFloat[] {
    if (this.lastBuffer === null || this.lastBuffer.length !== ctx.total_leds) {
      this.lastBuffer = new Array(ctx.total_leds).fill(BLACK);
      this.previousPhase = ctx.phase;
      this.previousHeadIndex = -1;
    }

    // 1. Fade proportional to phase progress
    let deltaPhase = ctx.phase - this.previousPhase;
    if (deltaPhase < 0) deltaPhase += 1; // handle wrap-around
    const fadeFactor = Math.max(0, 1.0 - deltaPhase * this.config.fadeFactor.value);

    for (let i = 0; i < this.lastBuffer.length; i++) {
      this.lastBuffer[i] = lerp(BLACK, this.lastBuffer[i], fadeFactor);
    }

    // 2. Draw the "Head" of the meteor, filling gaps if running fast
    const headIndex = Math.floor(ctx.phase * ctx.total_leds);
    const color = this.currentColor;

    // Fill all LEDs from previous position to current position to avoid gaps
    // But detect wrapping (when headIndex jumps back to start)
    if (this.previousHeadIndex >= 0 && headIndex >= this.previousHeadIndex) {
      // Normal forward movement - fill the gap
      for (let i = this.previousHeadIndex; i <= headIndex && i < this.lastBuffer.length; i++) {
        this.lastBuffer[i] = color;
      }
    } else if (headIndex < this.lastBuffer.length) {
      // Wrapped around — advance to next color from palette
      if (this.previousHeadIndex >= 0) {
        this.currentColor = this.config.palette.palette.nextColor().asRgb();
      }
      this.lastBuffer[headIndex] = this.currentColor;
    }

    this.previousHeadIndex = headIndex;
    this.previousPhase = ctx.phase;

    return this.lastBuffer;
  }
}

export class TwinkleEffect extends PerPixelEffect<AnimationMode.Sequence, LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
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
  renderPixel(ctx: EffectContextSequence, point: LedPoint1D): RgbFloat {
    if (Math.random() < this.probability.value / 100) {
      return hslToRgbFloat(this.color.value);
    }
    return BLACK;
  }
}

export class SineEffect extends PerPixelEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
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
  renderPixel(ctx: EffectContextLoop, point: LedPoint1D): RgbFloat {
    // We combine spatial position (pt.distance) with temporal progress (ctx.phase)
    const wave = Math.sin((point.distance * this.frequency.value + ctx.phase) * Math.PI * 2);

    // Map wave (-1 to 1) to brightness (0 to 1)
    const brightness = (wave + 1) / 2;

    // Use HSL to keep a consistent color but vary the lightness
    return hslToRgbFloat({ ...this.color.value, lightness: this.color.value.lightness * brightness });
  }
}

export class PingPongEffect extends PerPixelEffect<AnimationMode.Loop, LedPoint1D> {
  readonly animationMode = AnimationMode.Loop;
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
  renderPixel(ctx: EffectContextLoop, point: LedPoint1D): RgbFloat {
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
