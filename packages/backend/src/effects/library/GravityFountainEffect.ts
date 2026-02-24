import { type RgbFloat, BLACK, WHITE } from '../../color/ColorFloat';
import { AnimationMode, type EffectSequence, LedPoint2D, EffectLogic, type EffectContextSequence } from '../Effect';


export class GravityFountainEffect implements EffectSequence<LedPoint2D> {
  readonly animationMode = AnimationMode.Sequence;
  pointType: '2D' = '2D';
  readonly isStateful: true = true;
  getName(): string {
    return 'Gravity Fountain';
  }
  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint2D> = () => new GravityFountainLogic();
}
class GravityFountainLogic implements EffectLogic<AnimationMode.Sequence, LedPoint2D> {
  private particles: { x: number; y: number; vy: number; }[] = [];
  private lastTime = 0;

  renderGlobal(ctx: EffectContextSequence, points: LedPoint2D[]): RgbFloat[] {
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
