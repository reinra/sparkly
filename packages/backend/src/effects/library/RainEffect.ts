import { type RgbFloat, BLACK, lerp } from '../../color/ColorFloat';
import { BLUE_HSL_COLOR, hslToRgbFloat, randomColorMaxSaturation } from '../../color/Hsl';
import { EffectParameterStorage } from '../../EffectParameters';
import { ParameterType } from '../../ParameterTypes';
import {
  AnimationMode,
  type EffectSequence,
  type LedPoint1D,
  EffectLogic,
  type EffectContextSequence,
} from '../Effect';
import { createBlackBuffer } from '../util/ArrayUtils';

abstract class BaseRainEffect implements EffectSequence<LedPoint1D> {
  readonly animationMode = AnimationMode.Sequence;
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
  createLogic: () => EffectLogic<AnimationMode.Sequence, LedPoint1D> = () => new RainEffectLogic(this);
  abstract nextColor(): RgbFloat;
}

export class SingleColorRainEffect extends BaseRainEffect {
  readonly effectId = 'rain_single_color';
  readonly effectName = 'Single-Color Rain';
  readonly color = this.parameters.register({
    id: 'color',
    name: 'Color',
    description: 'HSL color value',
    type: ParameterType.HSL,
    value: BLUE_HSL_COLOR,
  });
  nextColor(): RgbFloat {
    return this.color.color.asRgb();
  }
}

export class MultiColorRainEffect extends BaseRainEffect {
  readonly effectId = 'rain_multi_color';
  readonly effectName = 'Multi-Color Rain';
  nextColor(): RgbFloat {
    return hslToRgbFloat(randomColorMaxSaturation());
  }
}
interface Particle {
  position: number;
  velocity: number;
  color: RgbFloat;
}
class RainEffectLogic implements EffectLogic<AnimationMode.Sequence, LedPoint1D> {
  private particles: Particle[] = [];
  constructor(private readonly config: BaseRainEffect) {}
  renderGlobal(ctx: EffectContextSequence, points: LedPoint1D[]): RgbFloat[] {
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

    const buffer = createBlackBuffer(points.length);

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
