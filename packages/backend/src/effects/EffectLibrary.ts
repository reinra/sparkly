import { RgbValue } from '../color/Color';
import type { AnyEffect } from '../render/Renderer';
import { ChangeColorEffect, FlipColorEffect, MeteorEffect, PingPongEffect, RainbowGradientEffect1D, RainEffect, RotatingColorGradientEffect, SineEffect, SingleColorEffect, StaticColorGradientEffect, TestPerLedEffect1D, TwinkleEffect } from './generic/Effects1D';
import { AdapterFrom1DEffectTo2D, CloudsEffect, GravityFountain, PlasmaEffect, PulseScanner, RainbowGradientEffect2D, Slime } from './generic/Effects2D';

const redGreenBlue: RgbValue[] = [
  { red: 255, green: 0, blue: 0 },
  { red: 0, green: 255, blue: 0 },
  { red: 0, green: 0, blue: 255 },
];

export const effects: Record<string, AnyEffect> = {
  flip_color: new FlipColorEffect(redGreenBlue),
  change_color: new ChangeColorEffect(redGreenBlue),
  red: new SingleColorEffect({ red: 255, green: 0, blue: 0 }),
  green: new SingleColorEffect({ red: 0, green: 255, blue: 0 }),
  blue: new SingleColorEffect({ red: 0, green: 0, blue: 255 }), 
  black: new SingleColorEffect({ red: 0, green: 0, blue: 0 }),
  white: new SingleColorEffect({ red: 255, green: 255, blue: 255 }),
  gradient_2: new StaticColorGradientEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 255, green: 255, blue: 0 },
  ]),
  gradient_3: new StaticColorGradientEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 0, green: 255, blue: 0 },
    { red: 0, green: 0, blue: 255 },
  ]),
  gradient_4: new StaticColorGradientEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 0, green: 255, blue: 0 },
    { red: 0, green: 0, blue: 255 },
    { red: 255, green: 0, blue: 0 }
  ]),
  rotating_gradient_4: new RotatingColorGradientEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 0, green: 255, blue: 0 },
    { red: 0, green: 0, blue: 255 },
    { red: 255, green: 0, blue: 0 }
  ]),
  test_per_led: new TestPerLedEffect1D(),
  new_rainbow: new RainbowGradientEffect1D(),
  meteor: new MeteorEffect(),
  rain: new RainEffect(),
  twinkle: new TwinkleEffect(),
  sine: new SineEffect(2),
  ping_pong: new PingPongEffect(),
  rainbow_2d: new RainbowGradientEffect2D(),
  sine_2d: new AdapterFrom1DEffectTo2D(new SineEffect(3)),
  pulse_scanner: new PulseScanner(),
  slime: new Slime(),
  clouds: new CloudsEffect(),
  plasma: new PlasmaEffect(),
  gravity_fountain: new GravityFountain(),
};
