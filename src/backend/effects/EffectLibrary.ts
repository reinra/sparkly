import type { AnyEffect } from '../render/Renderer';
import { MeteorEffect, RainbowGradientEffect1D, RainEffect, TestPerLedEffect1D } from './generic/Effects1D';
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
  rain: new RainEffect()
};
