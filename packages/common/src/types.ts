// Mode enum shared between backend and frontend
// This represents the operating mode of Twinkly devices
export enum Mode {
  off = 'off',
  demo = 'demo',
  effect = 'effect',
  movie = 'movie',
  rt = 'rt',
}

export interface Hsl {
  hue: number; // Hue: 0-1
  saturation: number; // Saturation: 0-1
  lightness: number; // Lightness: 0-1
}

export enum ParameterType {
  RANGE = 'range',
  BOOLEAN = 'boolean',
  HSL = 'hsl',
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

export interface HslEffectParameter extends BaseEffectParameter {
  type: ParameterType.HSL;
  value: Hsl;
}

export type EffectParameter = RangeEffectParameter | BooleanEffectParameter | HslEffectParameter;
