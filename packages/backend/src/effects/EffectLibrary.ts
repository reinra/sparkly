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
  AlternatingColorFadingEffect,
  StaticCustomColorGradientEffect,
  TestAllLedsFlash,
  StaticAlternatingColorEffect,
  TestRgbPickerEffect,
  TestColorPickerEffect,
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
register(AlternatingColorFadingEffect);
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
register(StaticAlternatingColorEffect);
register(StaticColorGradientEffect);
register(StaticCustomColorGradientEffect);

// Test effects
register(TestPerLedEffect);
register(TestAllLedsFlash);
register(TestRgbPickerEffect);
register(TestColorPickerEffect);

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

/**
 * Create a fresh EffectWrapper for the given effect ID, reconstructing it from code defaults.
 * - Library effects (preset-based or single-entry): fully reconstructed from code, identical to startup.
 * - User/cloned effects (canDelete, no matching preset/effectId): wrapper params reset to defaults,
 *   but the Effect's own parameters are preserved from the previous instance since there is
 *   no code-defined default for them.
 */
function createFreshWrapper(existing: EffectWrapper): EffectWrapper {
  const EffectClass = existing.effect.constructor as new () => AnyEffect;
  const freshEffect = new EffectClass();
  const presets = freshEffect.getPresets?.();

  if (presets && presets.length > 0) {
    const preset = presets.find((p) => p.id === existing.id);
    if (preset) {
      // Preset-based library effect: reconstruct exactly as register() does
      const wrapper = new EffectWrapper(existing.id, freshEffect, preset.name);
      for (const [paramId, value] of preset.config.entries()) {
        wrapper.getEffectParameters().setValue(paramId, value);
      }
      return wrapper;
    }
    // User effect (clone of a preset-based effect): fresh wrapper params,
    // but re-apply the Effect's own params from the previous instance
    const wrapper = new EffectWrapper(existing.id, freshEffect, existing.getName(), existing.canDelete);
    copyEffectOwnParameters(existing, wrapper);
    return wrapper;
  }

  if (freshEffect.effectId && freshEffect.effectName && freshEffect.effectId === existing.id) {
    // Single-entry library effect: reconstruct from code
    return new EffectWrapper(existing.id, freshEffect, freshEffect.effectName);
  }

  // User effect (clone of a single-entry effect): fresh wrapper params,
  // but re-apply the Effect's own params from the previous instance
  const wrapper = new EffectWrapper(existing.id, freshEffect, existing.getName(), existing.canDelete);
  copyEffectOwnParameters(existing, wrapper);
  return wrapper;
}

/**
 * Replace an effect in the effects record, preserving insertion order.
 */
function replaceEffect(effectId: string, newWrapper: EffectWrapper): void {
  const entries = Object.entries(effects);
  for (const key of Object.keys(effects)) {
    delete effects[key];
  }
  for (const [id, wrapper] of entries) {
    effects[id] = id === effectId ? newWrapper : wrapper;
  }
}

/**
 * Reset an effect to its code-defined defaults by creating a completely fresh instance
 * and replacing the old one in the effects record.
 * Returns the new EffectWrapper so callers can update device references.
 */
export function resetEffect(effectId: string): EffectWrapper {
  const existing = effects[effectId];
  if (!existing) {
    throw new Error(`Effect '${effectId}' not found`);
  }

  const newWrapper = createFreshWrapper(existing);
  replaceEffect(effectId, newWrapper);
  return newWrapper;
}

/**
 * Copy the Effect's own parameters from one wrapper's effect to another.
 * Used for user/cloned effects where there's no code-defined default to reconstruct from.
 */
function copyEffectOwnParameters(source: EffectWrapper, target: EffectWrapper): void {
  const sourceParams = source.effect.parameters;
  const targetParams = target.effect.parameters;
  if (!sourceParams || !targetParams) return;

  for (const param of sourceParams.list()) {
    targetParams.setValue(param.id, param.value);
  }
}

export { effects };
