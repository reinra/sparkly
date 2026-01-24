import type { AnyEffect } from '../render/Renderer';
import { SimpleColorEffect, SmoothSameColorEffect } from './SameColorEffect';
import { GradientStaticStripEffect } from './StaticStripEffect';
import { RotatingStrictEffect, TestPerLedEffect } from './StripEffect';

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
};
