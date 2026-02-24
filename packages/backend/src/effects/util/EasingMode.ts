import { EffectParameterStorage } from '../../effectParameters';
import { OptionEffectParameter, ParameterType } from '../../ParameterTypes';
import {
  CubicIn,
  CubicInOut,
  CubicOut,
  Easing,
  EasingIn,
  EasingOut,
  LinearIn,
  LinearInOut,
  LinearOut,
  NoopIn,
  NoopInOut,
  NoopOut,
} from './Easing';

export enum EasingMode {
  Noop = 'noop',
  Linear = 'linear',
  Cubic = 'cubic',
}

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
      { value: EasingMode.Cubic, label: 'Cubic', description: 'Cubic easing' },
    ],
  });
  public getInEasingFunction(): EasingIn {
    const mode = this.type.value as EasingMode;
    switch (mode) {
      case EasingMode.Noop:
        return NoopIn;
      case EasingMode.Linear:
        return LinearIn;
      case EasingMode.Cubic:
        return CubicIn;
    }
  }
  public getOutEasingFunction(): EasingOut {
    const mode = this.type.value as EasingMode;
    switch (mode) {
      case EasingMode.Noop:
        return NoopOut;
      case EasingMode.Linear:
        return LinearOut;
      case EasingMode.Cubic:
        return CubicOut;
    }
  }
}

export enum FullEasingMode {
  Noop = 'noop',
  LinearIn = 'linear_in',
  LinearOut = 'linear_out',
  LinearInOut = 'linear_in_out',
  CubicIn = 'cubic_in',
  CubicOut = 'cubic_out',
  CubicInOut = 'cubic_in_out',
}

/**
 * Easing parameter that lets the user choose the full easing function
 * including direction (In, Out, In-Out).
 */
export class FullEasingParameters {
  public readonly parameters = new EffectParameterStorage();
  private readonly type: OptionEffectParameter = this.parameters.register({
    id: 'type',
    name: 'Easing',
    description: 'Easing function including direction',
    type: ParameterType.OPTION,
    value: FullEasingMode.LinearIn,
    options: [
      { value: FullEasingMode.Noop, label: 'None', description: 'No easing' },
      { value: FullEasingMode.LinearIn, label: 'Linear In', description: 'Linear ease in' },
      { value: FullEasingMode.LinearOut, label: 'Linear Out', description: 'Linear ease out' },
      { value: FullEasingMode.LinearInOut, label: 'Linear In-Out', description: 'Linear ease in-out' },
      { value: FullEasingMode.CubicIn, label: 'Cubic In', description: 'Cubic ease in' },
      { value: FullEasingMode.CubicOut, label: 'Cubic Out', description: 'Cubic ease out' },
      { value: FullEasingMode.CubicInOut, label: 'Cubic In-Out', description: 'Cubic ease in-out' },
    ],
  });

  public getEasingFunction(): Easing {
    const mode = this.type.value as FullEasingMode;
    switch (mode) {
      case FullEasingMode.Noop:
        return NoopIn;
      case FullEasingMode.LinearIn:
        return LinearIn;
      case FullEasingMode.LinearOut:
        return LinearOut;
      case FullEasingMode.LinearInOut:
        return LinearInOut;
      case FullEasingMode.CubicIn:
        return CubicIn;
      case FullEasingMode.CubicOut:
        return CubicOut;
      case FullEasingMode.CubicInOut:
        return CubicInOut;
    }
  }
}
