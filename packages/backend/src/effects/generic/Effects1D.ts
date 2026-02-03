import { BLACK, lerp, WHITE, type RgbValue } from '../../color/Color';
import { hslToRgb } from '../../color/Hsl';
import { BaseSameColorEffect, PerPixelEffect, type Effect, type EffectContext, type LedPoint1D } from './Effect';

export class SingleColorEffect extends BaseSameColorEffect {
  pointType: '1D' = '1D';
  constructor(private readonly color: RgbValue) {
    super();
  }
  getName(): string {
    return 'Single Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0;
  }
  renderColor(ctx: EffectContext): RgbValue {
    return this.color;
  }
}

export class FlipColorEffect extends BaseSameColorEffect {
  pointType: '1D' = '1D';
  constructor(private readonly colors: RgbValue[]) {
    super();
  }
  getName(): string {
    return 'Flip Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return this.colors.length * 2;
  }
  renderColor(ctx: EffectContext): RgbValue {
    const totalColors = this.colors.length;
    const index = Math.floor(ctx.phase * totalColors) % totalColors;
    return this.colors[index];
  }
}

export class ChangeColorEffect extends BaseSameColorEffect {
  pointType: '1D' = '1D';
  constructor(private readonly colors: RgbValue[]) {
    super();
  }
  getName(): string {
    return 'Change Color';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return this.colors.length * 2;
  }
  renderColor(ctx: EffectContext): RgbValue {
    const totalColors = this.colors.length;
    const colorPhase = (ctx.phase * totalColors) % totalColors;
    const fromIndex = Math.floor(colorPhase);
    const toIndex = (fromIndex + 1) % totalColors;
    const t = colorPhase - fromIndex; // Interpolation factor 0 to 1
    return lerp(this.colors[fromIndex], this.colors[toIndex], t);
  }
}

export class StaticColorGradientEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  private colors: RgbValue[];
  constructor(colors: RgbValue[]) {
    super();
    this.colors = colors;
  }
  getName(): string {
    return `Static Color Gradient (${this.colors.length} colors)`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 0; // Static effect has no loop
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = point.distance * (this.colors.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(this.colors[fromIndex], this.colors[toIndex], t);
  }
}

export class RotatingColorGradientEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  private colors: RgbValue[];
  constructor(colors: RgbValue[]) {
    super();
    this.colors = colors;
  }
  getName(): string {
    return `Rotating Color Gradient (${this.colors.length} colors)`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5; // Rotating effect has a loop duration
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // Map point.distance (0.0 to 1.0) to the color gradient
    const scaledPos = ((point.distance + ctx.phase) % 1.0) * (this.colors.length - 1);
    const fromIndex = Math.floor(scaledPos);
    const toIndex = Math.min(fromIndex + 1, this.colors.length - 1);
    const t = scaledPos - fromIndex; // Interpolation factor 0 to 1
    return lerp(this.colors[fromIndex], this.colors[toIndex], t);
  }
}

// Also called "Marquee" if it runs a bit faster
export class TestPerLedEffect1D implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = false;
  getName(): string {
    return 'Test Per-Led 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return ledCount / 2;
  }
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbValue[] {
    const result: RgbValue[] = new Array(points.length).fill(BLACK);
    const index = Math.floor(ctx.phase * points.length);
    result[index] = WHITE;
    return result;
  }
}

export class RainbowGradientEffect1D extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  getName(): string {
    return 'Rainbow Gradient 1D';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.distance) % 1.0;
    return hslToRgb({ hue, saturation: 1, lightness: 0.5 });
  }
}

export class MeteorEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  private lastBuffer: RgbValue[] | null = null;
  private previousHeadIndex: number = -1;
  getName(): string {
    return 'Meteor';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbValue[] {
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

interface Particle {
  pos: number;
  vel: number;
  color: RgbValue;
}
export class RainEffect implements Effect<LedPoint1D> {
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  private particles: Particle[] = [];
  getName(): string {
    return 'Rain';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 60;
  }
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbValue[] {
    // 1. Move existing particles based on velocity and time passed
    this.particles.forEach((p) => {
      p.pos += p.vel * (ctx.delta_time_ms / 1000) * ctx.speed;
    });

    // 2. Remove off-screen particles
    this.particles = this.particles.filter((p) => p.pos < ctx.total_leds);

    // 3. Add new particles "randomly" using a Seeded PRNG
    if (Math.random() > 0.9) {
      this.particles.push({ pos: 0, vel: Math.random() * 10, color: { red: 0, green: 0, blue: 255 } });
    }

    const buffer: RgbValue[] = new Array(points.length).fill(BLACK);

    // Draw particles
    for (const p of this.particles) {
      const idx = Math.floor(p.pos);
      if (idx >= 0 && idx < buffer.length) {
        buffer[idx] = p.color;
      }
    }
    return buffer;
  }
}

export class TwinkleEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  getName(): string {
    return 'Twinkle';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 1;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    if (Math.random() < 0.01) {
      return WHITE;
    }
    return BLACK;
  }
}

export class SineEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  constructor(private readonly frequency: number = 2) {
    super();
  }
  getName(): string {
    return `Sine Wave Effect (${this.frequency} cycles)`;
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // We combine spatial position (pt.distance) with temporal progress (ctx.phase)
    const wave = Math.sin((point.distance * this.frequency + ctx.phase) * Math.PI * 2);

    // Map wave (-1 to 1) to brightness (0 to 1)
    const brightness = (wave + 1) / 2;

    // Use HSL to keep a consistent color but vary the lightness
    return hslToRgb({ hue: 0.1, saturation: 1.0, lightness: brightness * 0.5 });
  }
}

export class PingPongEffect extends PerPixelEffect<LedPoint1D> {
  pointType: '1D' = '1D';
  getName(): string {
    return 'Ping Pong';
  }
  getLoopDurationSeconds(ledCount: number): number {
    return 5;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // Convert 0...1 phase into 0...1...0 bounce
    const bounce = 1.0 - Math.abs(ctx.phase * 2 - 1);

    const pulseWidth = 0.1;

    // Calculate distance from LED to the current bounce position
    const dist = Math.abs(point.distance - bounce);

    // Create a sharp pulse with soft edges
    const intensity = Math.max(0, 1.0 - dist / pulseWidth);

    // Shift hue based on direction
    const hue = ctx.phase < 0.5 ? 0.6 : 0.0; // Blue going one way, Red the other

    return hslToRgb({ hue, saturation: 1.0, lightness: intensity * 0.5 });
  }
}
