export enum ParameterType {
  RANGE = 'range',
  BOOLEAN = 'boolean',
  HSL = 'hsl',
  OPTION = 'option',
  MULTI_HSL = 'multi_hsl',
  RGB = 'rgb',
}

export enum ParameterGroup {
  DEVICE = 'device',
  EFFECT = 'effect',
}

export interface BaseEffectParameter {
  id: string;
  name: string;
  description: string;
  type: ParameterType;
  hidden?: boolean; // If true, this parameter should not be exposed in the UI
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

export interface Hsl {
  hue: number; // Hue: 0-1
  saturation: number; // Saturation: 0-1
  lightness: number; // Lightness: 0-1
}
export interface HslEffectParameter extends BaseEffectParameter {
  type: ParameterType.HSL;
  value: Hsl;
  /** Backend-only: the current value as a Color object, kept in sync with `value` */
  color: Color;
}

export interface Option {
  value: string;
  label: string;
  description?: string;
}
export interface OptionEffectParameter extends BaseEffectParameter {
  type: ParameterType.OPTION;
  value: string;
  options: Option[];
}

export interface MultiHslEffectParameter extends BaseEffectParameter {
  type: ParameterType.MULTI_HSL;
  value: Hsl[];
  /** Backend-only: the current values as Color objects, kept in sync with `value` */
  colors: Color[];
}

import type { RgbFloat } from './color/ColorFloat';
import type { Color } from './color/Color';

export interface RgbEffectParameter extends BaseEffectParameter {
  type: ParameterType.RGB;
  value: RgbFloat;
  /** Backend-only: the current value as a Color object, kept in sync with `value` */
  color: Color;
}

export type EffectParameter =
  | RangeEffectParameter
  | BooleanEffectParameter
  | HslEffectParameter
  | OptionEffectParameter
  | MultiHslEffectParameter
  | RgbEffectParameter;
