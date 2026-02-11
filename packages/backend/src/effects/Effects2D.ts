import { ParameterType } from '@twinkly-ts/common';
import { BLACK, WHITE, type RgbFloat, lerp, blend } from '../color/ColorFloat';
import { hslToRgbFloat, multiplyIntensity } from '../color/Hsl';
import { EffectParameterStorage } from '../effectParameters';
import { PerPixelEffect, LedPoint2D, EffectContext, LedPoint1D, StatelessEffect, EffectLogic, Effect } from './Effect';
import { NoiseGenerator } from './NoiseUtils';

export class AdapterFrom1DEffectTo2D implements Effect<LedPoint2D> {
  pointType: '2D' = '2D';
  constructor(private effect1D: Effect<LedPoint1D>) {}
  get isStateful(): boolean {
    return this.effect1D.isStateful;
  }
  getName(): string {
    return `Adapter(2D<-1D): ${this.effect1D.getName()}`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return this.effect1D.getLoopDurationSeconds(ledCount);
  }
  createLogic: () => EffectLogic<LedPoint2D> = () => new AdapterFrom1DEffectTo2DLogic(this.effect1D.createLogic());
}
class AdapterFrom1DEffectTo2DLogic implements EffectLogic<LedPoint2D> {
  constructor(private effect1D: EffectLogic<LedPoint1D>) {}
  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
    // Map the 2D points to 1D points by using only the X coordinate
    const points1D: LedPoint1D[] = points.map((point) => ({
      id: point.id,
      position: point.id,
      distance: point.y,
    }));
    return this.effect1D.renderGlobal(ctx, points1D);
  }
}

export class RainbowGradientEffect2D extends PerPixelEffect<LedPoint2D> {
  pointType: '2D' = '2D';
  getName(): string {
    return 'Rainbow Gradient 2D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint2D): RgbFloat {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.x) % 1.0;
    return hslToRgbFloat({ hue, saturation: point.y, lightness: 0.5 });
  }
}

export class PulseScanner implements StatelessEffect<LedPoint2D> {
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
  createLogic: () => EffectLogic<LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
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

export class Slime implements StatelessEffect<LedPoint2D> {
  pointType: '2D' = '2D';
  readonly isStateful: false = false;
  private noise = new NoiseGenerator();

  getName(): string {
    return 'Slime';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  createLogic: () => EffectLogic<LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
    // Get seamless loop coordinates
    const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);

    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    for (const pt of points) {
      // Scale coordinates to control "blob" size
      const noiseVal = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);

      // Use noise to pick a Hue
      const hue = this.noise.normalize(noiseVal);
      buffer[pt.id] = hslToRgbFloat({ hue, saturation: 0.8, lightness: 0.5 });
    }
    return buffer;
  }
}

export class CloudsEffect implements StatelessEffect<LedPoint2D> {
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
  getLoopDurationSeconds(ledCount: number): number {
    return 60;
  }
  createLogic: () => EffectLogic<LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
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

export class PlasmaEffect implements StatelessEffect<LedPoint2D> {
  pointType: '2D' = '2D';
  readonly isStateful: false = false;
  private noise = new NoiseGenerator();
  getName(): string {
    return 'Plasma';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 8;
  }
  createLogic: () => EffectLogic<LedPoint2D> = () => this;
  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    const [nz, nw] = this.noise.getLoopCoordinates(ctx.phase);

    for (const pt of points) {
      // Combine multiple noise layers at different scales for complex patterns
      const noise1 = this.noise.get4D(pt.x * 2, pt.y * 2, nz, nw);
      const noise2 = this.noise.get4D(pt.x * 4, pt.y * 4, nz * 0.5, nw * 0.5);
      const noise3 = this.noise.get4D(pt.x * 8, pt.y * 8, nz * 0.25, nw * 0.25);

      // Blend the noise layers
      const combined = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;

      // Map to rainbow colors
      const hue = this.noise.normalize(combined);
      buffer[pt.id] = hslToRgbFloat({ hue, saturation: 1.0, lightness: 0.5 });
    }
    return buffer;
  }
}

export class GravityFountain implements Effect<LedPoint2D> {
  pointType: '2D' = '2D';
  readonly isStateful: true = true;
  getName(): string {
    return 'Gravity Fountain';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 60; // Continuous effect, no loop
  }
  createLogic: () => EffectLogic<LedPoint2D> = () => new GravityFountainLogic();
}

class GravityFountainLogic implements EffectLogic<LedPoint2D> {
  private particles: { x: number; y: number; vy: number }[] = [];
  private lastTime = 0;

  renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbFloat[] {
    // Calculate delta time
    const dt = this.lastTime === 0 ? 16 : ctx.time_ms - this.lastTime;
    this.lastTime = ctx.time_ms;
    const dtSec = dt / 1000;
    const gravity = 1.5;

    // 1. Move particles
    this.particles.forEach((p) => {
      p.vy += gravity * dtSec; // Apply gravity to velocity
      p.y += p.vy * dtSec; // Apply velocity to position
    });

    // 2. Spawn new ones at the bottom
    // Use ctx.millis for pseudo-random behavior
    const spawnChance = (Math.sin(ctx.time_ms * 0.01) + 1) * 0.5;
    if (spawnChance > 0.8) {
      const x = (Math.sin(ctx.time_ms * 0.003) + 1) * 0.5;
      this.particles.push({ x, y: 1.0, vy: -1.5 });
    }

    // 3. Cleanup
    this.particles = this.particles.filter((p) => p.y <= 1.1);

    // 4. Render
    const buffer: RgbFloat[] = new Array(points.length).fill(BLACK);
    for (const p of this.particles) {
      // Find the closest LED to the particle's X, Y
      // Use a radius-based blend for better looks
      for (const pt of points) {
        const d = Math.sqrt((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2);
        if (d < 0.05) {
          const intensity = 1 - d / 0.05;
          const color = WHITE;
          // Blend with existing color
          buffer[pt.id] = {
            red_f: Math.min(1, buffer[pt.id].red_f + color.red_f * intensity),
            green_f: Math.min(1, buffer[pt.id].green_f + color.green_f * intensity),
            blue_f: Math.min(1, buffer[pt.id].blue_f + color.blue_f * intensity),
          };
        }
      }
    }
    return buffer;
  }
}
