import { randomUUID } from 'node:crypto';
import { EffectWrapper } from '../EffectWrapper';
import { type AnyEffect } from './Effect';
import {
  MeteorEffect,
  PingPongEffect,
  RainbowGradientEffect,
  RotatingColorGradientEffect,
  StaticSingleColorEffect,
  StaticColorGradientEffect,
  TestPerLedEffect,
  TwinkleEffect,
  AlternatingCustomColorFadingEffect,
  StaticCustomColorGradientEffect,
  TestAllLedsFlash,
  StaticAlternatingColorCustomEffect,
  TestRgbPickerEffect,
} from './library/Effects1D';
import { WaveEffect } from './library/WaveEffect';
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

function register<T extends AnyEffect>(EffectClass: new () => T): void {
  const template = new EffectClass();
  const presets = template.getPresets?.();

  if (presets && presets.length > 0) {
    // Preset-based: one library entry per preset
    for (const preset of presets) {
      const effect = new EffectClass();
      const wrapper = new EffectWrapper(preset.id, effect, preset.name);
      for (const [paramId, value] of preset.config.entries()) {
        wrapper.getEffectParameters().setValue(paramId, value);
      }
      effects[preset.id] = wrapper;
    }
  } else if (template.effectId && template.effectName) {
    // Single entry: use the effect's own id + name
    effects[template.effectId] = new EffectWrapper(template.effectId, template, template.effectName);
  } else {
    throw new Error(`Effect ${EffectClass.name} must provide either getPresets() or effectId + effectName`);
  }
}

register(BlocksEffect);
register(StarsEffect);
register(AlternatingCustomColorFadingEffect);
register(RandomDotsClearEffect);
register(RandomDotsLoopEffect);
register(RandomDotsStaticEffect);
register(MeteorEffect);
register(SingleColorRainEffect);
register(MultiColorRainEffect);
register(TwinkleEffect);
register(WaveEffect);
register(PingPongEffect);
register(RainbowGradientEffect2D);
register(PulseScanner);
register(Slime);
register(CloudsEffect);
register(PlasmaEffect);
register(GravityFountainEffect);

// Simple effects
register(RainbowGradientEffect);
register(RotatingColorGradientEffect);

// Simple same color effects
register(ChangeColorEffect);

// Static effects
register(StaticSingleColorEffect);
register(StaticAlternatingColorCustomEffect);
register(StaticColorGradientEffect);
register(StaticCustomColorGradientEffect);

// Test effects
register(TestPerLedEffect);
register(TestAllLedsFlash);
register(TestRgbPickerEffect);

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
