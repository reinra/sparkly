import { randomUUID } from 'node:crypto';
import { EffectWrapper } from '../EffectWrapper';
import { type AnyEffect, EffectPreset } from './Effect';
import {
  MeteorEffect,
  PingPongEffect,
  RainbowGradientEffect,
  RotatingColorGradientEffect,
  SineEffect,
  StaticSingleColorEffect,
  StaticColorGradientEffect,
  TestPerLedEffect,
  TwinkleEffect,
  AlternatingCustomColorFadingEffect,
  StaticCustomColorGradientEffect,
  TestAllLedsFlash,
  StaticAlternatingColorCustomEffect,
} from './library/Effects1D';
import { ChangeColorEffect } from './library/ChangeColorEffect';
import { SingleColorRainEffect, MultiColorRainEffect } from './library/RainEffect';
import { BlocksEffect } from './library/BlocksEffect';
import { RandomDotsClearEffect } from './library/RandomDotsClearEffect';
import { RandomDotsLoopEffect } from './library/RandomDotsLoopEffect';
import { RandomDotsStaticEffect } from './library/RandomDotsStaticEffect';
import { CloudsEffect, PlasmaEffect, PulseScanner, RainbowGradientEffect2D, Slime } from './library/Effects2D';
import { GravityFountainEffect } from './library/GravityFountainEffect';
import { StarsEffect } from './library/StarsEffect';

const effects: Record<string, EffectWrapper> = {};

function addPresets<T extends AnyEffect & { getPresets(): EffectPreset[] }>(EffectClass: new () => T): void {
  const template = new EffectClass();
  const presets = template.getPresets();
  for (const preset of presets) {
    const effect = new EffectClass();
    const wrapper = new EffectWrapper(preset.id, effect, preset.name);
    for (const [paramId, value] of preset.config.entries()) {
      wrapper.getEffectParameters().setValue(paramId, value);
    }
    effects[preset.id] = wrapper;
  }
}

function add(id: string, effect: AnyEffect): void {
  effects[id] = new EffectWrapper(id, effect, effect.getName());
}

add('blocks', new BlocksEffect());
add('stars', new StarsEffect());
addPresets(AlternatingCustomColorFadingEffect);
add('random_dots_clear', new RandomDotsClearEffect());
add('random_dots_loop', new RandomDotsLoopEffect());
add('random_dots_static', new RandomDotsStaticEffect());
add('meteor', new MeteorEffect());
add('rain_single_color', new SingleColorRainEffect());
add('rain_multi_color', new MultiColorRainEffect());
add('twinkle', new TwinkleEffect());
add('sine', new SineEffect());
add('ping_pong', new PingPongEffect());
add('rainbow_2d', new RainbowGradientEffect2D());
add('pulse_scanner', new PulseScanner());
add('slime', new Slime());
add('clouds', new CloudsEffect());
add('plasma', new PlasmaEffect());
add('gravity_fountain', new GravityFountainEffect());

// Simple effects
add('rainbow', new RainbowGradientEffect());
addPresets(RotatingColorGradientEffect);

// Simple same color effects
addPresets(ChangeColorEffect);

// Static effects
addPresets(StaticSingleColorEffect);
addPresets(StaticAlternatingColorCustomEffect);
addPresets(StaticColorGradientEffect);
add('gradient_custom', new StaticCustomColorGradientEffect());

// Test effects
add('test_per_led', new TestPerLedEffect());
add('test_all_leds_flash', new TestAllLedsFlash());

export function deleteEffect(effectId: string): void {
  const effect = effects[effectId];
  if (!effect) {
    throw new Error(`Effect '${effectId}' not found`);
  }
  if (!effect.canDelete) {
    throw new Error(`Effect '${effectId}' cannot be deleted`);
  }
  delete effects[effectId];
}

export function cloneEffect(sourceId: string): { id: string; name: string } {
  const source = effects[sourceId];
  if (!source) {
    throw new Error(`Effect '${sourceId}' not found`);
  }

  const newId = randomUUID();
  const newName = `Copy of ${source.getName()}`;
  const cloned = source.clone(newId, newName);

  // Insert cloned effect right after the source in the ordered record
  const entries = Object.entries(effects);
  for (const key of Object.keys(effects)) {
    delete effects[key];
  }
  for (const [id, wrapper] of entries) {
    effects[id] = wrapper;
    if (id === sourceId) {
      effects[newId] = cloned;
    }
  }

  return { id: newId, name: newName };
}

export { effects };
