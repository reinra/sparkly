import type { AnyEffect } from '../render/Renderer';
import { MeteorEffect, PingPongEffect, RainbowGradientEffect1D, RainEffect, SineEffect, TestPerLedEffect1D, TwinkleEffect } from './generic/Effects1D';
import { AdapterFrom1DEffectTo2D, RainbowGradientEffect2D } from './generic/Effects2D';
import { SimpleColorEffect, SmoothSameColorEffect } from './old/SameColorEffect';
import { GradientStaticStripEffect } from './old/StaticStripEffect';
import { RotatingStrictEffect, TestPerLedEffect } from './old/StripEffect';

const gradient4 = new GradientStaticStripEffect([
  { red: 255, green: 0, blue: 0 },
  { red: 0, green: 255, blue: 0 },
  { red: 0, green: 0, blue: 255 },
  { red: 255, green: 0, blue: 0 },
]);

export const effects: Record<string, AnyEffect> = {
  simple: new SimpleColorEffect(),
  smooth: new SmoothSameColorEffect(new SimpleColorEffect(), 64),
  red: new GradientStaticStripEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 255, green: 0, blue: 0 },
  ]),
  black: new GradientStaticStripEffect([
    { red: 0, green: 0, blue: 0 },
    { red: 0, green: 0, blue: 0 },
  ]),
  white: new GradientStaticStripEffect([
    { red: 255, green: 255, blue: 255 },
    { red: 255, green: 255, blue: 255 },
  ]),
  gray: new GradientStaticStripEffect([
    { red: 128, green: 128, blue: 128 },
    { red: 128, green: 128, blue: 128 },
  ]),
  gradient_2: new GradientStaticStripEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 255, green: 255, blue: 0 },
  ]),
  gradient_3: new GradientStaticStripEffect([
    { red: 255, green: 0, blue: 0 },
    { red: 0, green: 255, blue: 0 },
    { red: 0, green: 0, blue: 255 },
  ]),
  gradient_4: gradient4,
  rotating_gradient_4: new RotatingStrictEffect(gradient4, 400, 3),
  test_per_led: new TestPerLedEffect(),
  new_test_per_led: new TestPerLedEffect1D(),
  new_rainbow: new RainbowGradientEffect1D(),
  meteor: new MeteorEffect(),
  rain: new RainEffect(),
  twinkle: new TwinkleEffect(),
  sine: new SineEffect(2),
  ping_pong: new PingPongEffect(),
  rainbow_2d: new RainbowGradientEffect2D(),
  sine_2d: new AdapterFrom1DEffectTo2D(new SineEffect(3)),
};
