import { EffectParameterStorage } from '../../effectParameters';
import { OptionEffectParameter, ParameterType } from '../../ParameterTypes';
import {
  circularEasing,
  cubicEasing,
  Direction,
  EasingFunction,
  exponentialEasing,
  linearEasing,
  noopEasing,
  quadraticEasing,
  quarticEasing,
  sineEasing,
  wrapWithDirection,
} from './Easing';

export enum EasingMode {
  Noop = 'noop',
  Linear = 'linear',
  Quadratic = 'quadratic',
  Cubic = 'cubic',
  Quartic = 'quartic',
  Sine = 'sine',
  Exponential = 'exponential',
  Circular = 'circular',
}

function getBaseEasingFunction(mode: EasingMode): EasingFunction {
  switch (mode) {
    case EasingMode.Noop:
      return noopEasing;
    case EasingMode.Linear:
      return linearEasing;
    case EasingMode.Quadratic:
      return quadraticEasing;
    case EasingMode.Cubic:
      return cubicEasing;
    case EasingMode.Quartic:
      return quarticEasing;
    case EasingMode.Sine:
      return sineEasing;
    case EasingMode.Exponential:
      return exponentialEasing;
    case EasingMode.Circular:
      return circularEasing;
  }
}

/**
 * Easing parameter that lets the user choose an easing curve (Noop, Linear, Cubic).
 * Provides convenience methods for In/Out wrapped functions.
 */
export class EasingParameters {
  public readonly parameters = new EffectParameterStorage();
  private readonly type: OptionEffectParameter = this.parameters.register({
    id: 'type',
    name: 'Easing',
    description: 'Easing function to use for fade-in and fade-out',
    type: ParameterType.OPTION,
    value: EasingMode.Linear,
    options: [
      { value: EasingMode.Noop, label: 'Noop', description: 'No easing' },
      { value: EasingMode.Linear, label: 'Linear', description: 'Linear easing' },
      { value: EasingMode.Quadratic, label: 'Quadratic', description: 'Gentle acceleration' },
      { value: EasingMode.Cubic, label: 'Cubic', description: 'Cubic easing' },
      { value: EasingMode.Quartic, label: 'Quartic', description: 'Strong acceleration' },
      { value: EasingMode.Sine, label: 'Sine', description: 'Smooth, natural feel' },
      { value: EasingMode.Exponential, label: 'Exponential', description: 'Dramatic, starts slow then snaps' },
      { value: EasingMode.Circular, label: 'Circular', description: 'Circle arc, smooth start' },
    ],
  });

  public getInEasingFunction(): EasingFunction {
    return wrapWithDirection(getBaseEasingFunction(this.type.value as EasingMode), Direction.In);
  }

  public getOutEasingFunction(): EasingFunction {
    return wrapWithDirection(getBaseEasingFunction(this.type.value as EasingMode), Direction.Out);
  }
}

/**
 * Easing parameter that lets the user choose direction (In, Out, In+Out)
 * and easing function (Noop, Linear, Cubic) independently.
 * The direction wraps the base easing function accordingly.
 */
export class FullEasingParameters {
  public readonly parameters = new EffectParameterStorage();
  private readonly direction: OptionEffectParameter = this.parameters.register({
    id: 'direction',
    name: 'Direction',
    description: 'Easing direction',
    type: ParameterType.OPTION,
    value: Direction.InOut,
    options: [
      { value: Direction.In, label: 'In', description: 'Fade in (0→1)' },
      { value: Direction.Out, label: 'Out', description: 'Fade out (1→0)' },
      { value: Direction.InOut, label: 'In+Out', description: 'Wave (0→1→0)' },
    ],
  });
  private readonly type: OptionEffectParameter = this.parameters.register({
    id: 'type',
    name: 'Easing',
    description: 'Easing function',
    type: ParameterType.OPTION,
    value: EasingMode.Linear,
    options: [
      { value: EasingMode.Noop, label: 'Noop', description: 'No easing (instant)' },
      { value: EasingMode.Linear, label: 'Linear', description: 'Linear easing' },
      { value: EasingMode.Quadratic, label: 'Quadratic', description: 'Gentle acceleration' },
      { value: EasingMode.Cubic, label: 'Cubic', description: 'Cubic easing' },
      { value: EasingMode.Quartic, label: 'Quartic', description: 'Strong acceleration' },
      { value: EasingMode.Sine, label: 'Sine', description: 'Smooth, natural feel' },
      { value: EasingMode.Exponential, label: 'Exponential', description: 'Dramatic, starts slow then snaps' },
      { value: EasingMode.Circular, label: 'Circular', description: 'Circle arc, smooth start' },
    ],
  });

  public getEasingFunction(): EasingFunction {
    const baseFn = getBaseEasingFunction(this.type.value as EasingMode);
    return wrapWithDirection(baseFn, this.direction.value as Direction);
  }
}
