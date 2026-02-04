// Mode enum shared between backend and frontend
// This represents the operating mode of Twinkly devices
export enum Mode {
  off = 'off',
  demo = 'demo',
  effect = 'effect',
  movie = 'movie',
  rt = 'rt',
}

export enum ParameterType {
  RANGE = 'range',
  BOOLEAN = 'boolean',
}

export interface BaseEffectParameter {
  id: string;
  name: string;
  description: string;
  type: ParameterType;
}

export interface RangeEffectParameter extends BaseEffectParameter {
  type: ParameterType.RANGE;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
}

export interface BooleanEffectParameter extends BaseEffectParameter {
  type: ParameterType.BOOLEAN;
  value: boolean;
}

export type EffectParameter = RangeEffectParameter | BooleanEffectParameter;
