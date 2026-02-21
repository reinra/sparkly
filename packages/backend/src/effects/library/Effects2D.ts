import { ParameterType } from '../../ParameterTypes';
import { BLACK, type RgbFloat, lerp, blend } from '../../color/ColorFloat';
import { hslToRgbFloat, multiplyIntensity } from '../../color/Hsl';
import { EffectParameterStorage } from '../../effectParameters';
import { PerPixelEffect, LedPoint2D, type EffectContextLoop, type EffectContextSequence, type StatelessEffect, EffectLogic, AnimationMode } from '../Effect';
import { NoiseGenerator } from '../util/NoiseUtils';

export class RainbowGradientEffect2D extends PerPixelEffect<AnimationMode.Loop, LedPoint2D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '2D' = '2D';
  getName(): string {
    return 'Rainbow Gradient 2D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContextLoop, point: LedPoint2D): RgbFloat {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.x) % 1.0;
    return hslToRgbFloat({ hue, saturation: point.y, lightness: 0.5 });
  }
}

export class PulseScanner implements StatelessEffect<AnimationMode.Loop, LedPoint2D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '2D' = '2D';
  readonly isStateful: false = false;
  readonly parameters = new EffectParameterStorage();
  private readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: { hue: 0.6, saturation: 1.0, lightness: 0.5 },
  });
  getName(): string {
    return 'Pulse Scanner 2D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContextLoop, points: LedPoint2D[]): RgbFloat[] {
    const centerX = 0.5,
      centerY = 0.5;
    const maxRadius = 0.7; // Reach the corners
    const currentRadius = ctx.phase * maxRadius;
    const thickness = 0.1;

    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    for (const pt of points) {
      const dist = Math.sqrt((pt.x - centerX) ** 2 + (pt.y - centerY) ** 2);

      // Calculate how close the LED is to the ring edge
      // This creates a "peak" of brightness at currentRadius
      const edgeDist = Math.abs(dist - currentRadius);
      const intensity = Math.max(0, 1.0 - edgeDist / thickness);

      // Fade out as the ring gets larger
      const alpha = intensity * (1.0 - ctx.phase);

      buffer[pt.id] = hslToRgbFloat({ ...this.color.value, lightness: this.color.value.lightness * alpha });
    }
    return buffer;
  }
}

export class Slime implements StatelessEffect<AnimationMode.Loop, LedPoint2D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '2D' = '2D';
  readonly isStateful: false = false;
  readonly parameters = new EffectParameterStorage();
  private readonly hueShift = this.parameters.register({
    id: 'hueShift',
    name: 'Hue Shift',
    description: 'Shifts the hue of the slime colors',
    type: ParameterType.RANGE,
    value: 0,
    min: 0,
    max: 1,
    step: 0.01,
  });
  private noise = new NoiseGenerator();

  getName(): string {
    return 'Slime';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContextLoop, points: LedPoint2D[]): RgbFloat[] {
    // Get seamless loop coordinates
    const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);

    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    for (const pt of points) {
      // Scale coordinates to control "blob" size
      const noiseVal = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);

      // Use noise to pick a Hue with hue shift
      const hue = (this.noise.normalize(noiseVal) + this.hueShift.value) % 1.0;
      buffer[pt.id] = hslToRgbFloat({ hue, saturation: 0.8, lightness: 0.5 });
    }
    return buffer;
  }
}

export class CloudsEffect implements StatelessEffect<AnimationMode.Sequence, LedPoint2D> {
  readonly animationMode = AnimationMode.Sequence;
  readonly supportsSeamlessLooping = false;
  pointType: '2D' = '2D';
  readonly parameters = new EffectParameterStorage();
  private readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value for the clouds',
    type: ParameterType.HSL,
    value: { hue: 0.55, saturation: 0.3, lightness: 0.8 },
  });
  readonly isStateful: false = false;
  private noise = new NoiseGenerator();

  getName(): string {
    return 'Clouds';
  }
  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContextSequence, points: LedPoint2D[]): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);

    for (const pt of points) {
      // Animate by scrolling through the Z dimension of 3D noise
      const noiseVal = this.noise.get3D(pt.x * 3, pt.y * 3, ctx.time_ms * 0.0002);

      // Use noise for brightness (clouds are white/blue)
      const brightness = this.noise.map(noiseVal, 0.2, 1.0);

      buffer[pt.id] = hslToRgbFloat(multiplyIntensity(this.color.value, brightness));
    }
    return buffer;
  }
}

export class PlasmaEffect implements StatelessEffect<AnimationMode.Loop, LedPoint2D> {
  readonly animationMode = AnimationMode.Loop;
  pointType: '2D' = '2D';
  readonly isStateful: false = false;
  readonly parameters = new EffectParameterStorage();
  private readonly hueShift = this.parameters.register({
    id: 'hueShift',
    name: 'Hue Shift',
    description: 'Shifts the hue of the plasma colors',
    type: ParameterType.RANGE,
    value: 0,
    min: 0,
    max: 1,
    step: 0.01,
  });
  private noise = new NoiseGenerator();
  getName(): string {
    return 'Plasma';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 8;
  }
  createLogic: () => EffectLogic<AnimationMode.Loop, LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContextLoop, points: LedPoint2D[]): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);

    for (const pt of points) {
      // Combine multiple noise layers at different scales for complex patterns
      const noise1 = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);
      const noise2 = this.noise.get4D(pt.x * 4, pt.y * 4, nz * 0.5, nw * 0.5);
      const noise3 = this.noise.get4D(pt.x * 8, pt.y * 8, nz * 0.25, nw * 0.25);

      // Blend the noise layers
      const combined = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;

      // Map to rainbow colors with hue shift
      const hue = (this.noise.normalize(combined) + this.hueShift.value) % 1.0;
      buffer[pt.id] = hslToRgbFloat({ hue, saturation: 1.0, lightness: 0.5 });
    }
    return buffer;
  }
}
