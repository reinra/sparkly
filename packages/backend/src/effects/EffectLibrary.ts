import { RgbFloat } from '../color/ColorFloat';
import type { AnyEffect } from '../render/Renderer';
import {
  ChangeColorEffect,
  FlipColorEffect,
  MeteorEffect,
  PingPongEffect,
  RainbowGradientEffect1D,
  RainEffect,
  RotatingColorGradientEffect,
  SineEffect,
  SingleColorEffect,
  StaticColorGradientEffect,
  TestPerLedEffect1D,
  TwinkleEffect,
} from './generic/Effects1D';
import {
  AdapterFrom1DEffectTo2D,
  CloudsEffect,
  GravityFountain,
  PlasmaEffect,
  PulseScanner,
  RainbowGradientEffect2D,
  Slime,
} from './generic/Effects2D';

const redGreenBlue: RgbFloat[] = [
  { red_f: 1, green_f: 0, blue_f: 0 },
  { red_f: 0, green_f: 1, blue_f: 0 },
  { red_f: 0, green_f: 0, blue_f: 1 },
];

export const effects: Record<string, AnyEffect> = {
  flip_color: new FlipColorEffect(redGreenBlue),
  change_color: new ChangeColorEffect(redGreenBlue),
  red: new SingleColorEffect({ red_f: 1, green_f: 0, blue_f: 0 }),
  green: new SingleColorEffect({ red_f: 0, green_f: 1, blue_f: 0 }),
  blue: new SingleColorEffect({ red_f: 0, green_f: 0, blue_f: 1 }),
  black: new SingleColorEffect({ red_f: 0, green_f: 0, blue_f: 0 }),
  white: new SingleColorEffect({ red_f: 1, green_f: 1, blue_f: 1 }),
  gradient_2: new StaticColorGradientEffect([
    { red_f: 1, green_f: 0, blue_f: 0 },
    { red_f: 1, green_f: 1, blue_f: 0 },
  ]),
  gradient_3: new StaticColorGradientEffect([
    { red_f: 1, green_f: 0, blue_f: 0 },
    { red_f: 0, green_f: 1, blue_f: 0 },
    { red_f: 0, green_f: 0, blue_f: 1 },
  ]),
  gradient_4: new StaticColorGradientEffect([
    { red_f: 1, green_f: 0, blue_f: 0 },
    { red_f: 0, green_f: 1, blue_f: 0 },
    { red_f: 0, green_f: 0, blue_f: 1 },
    { red_f: 1, green_f: 0, blue_f: 0 },
  ]),
  rotating_gradient_4: new RotatingColorGradientEffect([
    { red_f: 1, green_f: 0, blue_f: 0 },
    { red_f: 0, green_f: 1, blue_f: 0 },
    { red_f: 0, green_f: 0, blue_f: 1 },
    { red_f: 1, green_f: 0, blue_f: 0 },
  ]),
  test_per_led: new TestPerLedEffect1D(),
  new_rainbow: new RainbowGradientEffect1D(),
  meteor: new MeteorEffect(),
  rain: new RainEffect(),
  twinkle: new TwinkleEffect(),
  sine: new SineEffect(),
  ping_pong: new PingPongEffect(),
  rainbow_2d: new RainbowGradientEffect2D(),
  sine_2d: new AdapterFrom1DEffectTo2D(new SineEffect()),
  pulse_scanner: new PulseScanner(),
  slime: new Slime(),
  clouds: new CloudsEffect(),
  plasma: new PlasmaEffect(),
  gravity_fountain: new GravityFountain(),
};
