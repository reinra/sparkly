import type {
  EffectParameter,
  RangeEffectParameter,
  BooleanEffectParameter,
  HslEffectParameter,
  OptionEffectParameter,
  MultiHslEffectParameter,
  RgbEffectParameter,
  ColorEffectParameter,
  MultiColorEffectParameter,
  ColorValue,
  Hsl,
} from './ParameterTypes';
import { ParameterType, ColorMode } from './ParameterTypes';
import type { RgbFloat } from './color/ColorFloat';
import { HslColor, RgbColor } from './color/Color';

type ParameterValueType<T extends EffectParameter> = T extends RangeEffectParameter
  ? number
  : T extends BooleanEffectParameter
    ? boolean
    : T extends HslEffectParameter
      ? Hsl
      : T extends OptionEffectParameter
        ? string
        : T extends MultiHslEffectParameter
          ? Hsl[]
          : T extends RgbEffectParameter
            ? RgbFloat
            : T extends ColorEffectParameter
              ? ColorValue
              : T extends MultiColorEffectParameter
                ? ColorValue[]
                : never;

export type ParameterChangeListener<T extends EffectParameter = EffectParameter> = (
  parameter: T,
  oldValue: ParameterValueType<T>,
  newValue: ParameterValueType<T>
) => void | Promise<void>;

export type ParameterValue = number | boolean | Hsl | string | Hsl[] | RgbFloat | ColorValue | ColorValue[];

/** A parameter with default-tracking: knows whether its current value equals the initial default. */
export type WithDefault<T extends EffectParameter> = T & { isDefault(): boolean };

/** A registered parameter with default-tracking. */
export type RegisteredParameter = WithDefault<EffectParameter>;

const HSL_RANGE_ERROR = `HSL components must be between 0 and 1 inclusive`;
const RGB_RANGE_ERROR = `RGB components must be between 0 and 1 inclusive`;

function validateHslValue(id: string, value: Hsl): void {
  const ensure = (component: keyof Hsl) => {
    const componentValue = value[component];
    if (typeof componentValue !== 'number' || Number.isNaN(componentValue)) {
      throw new Error(`Parameter '${id}' expects numeric ${component} value`);
    }
    if (componentValue < 0 || componentValue > 1) {
      throw new Error(`Parameter '${id}': ${HSL_RANGE_ERROR} (received ${component}: ${componentValue})`);
    }
  };

  ensure('hue');
  ensure('saturation');
  ensure('lightness');
}

function validateRgbFloatValue(id: string, value: RgbFloat): void {
  const ensure = (component: keyof RgbFloat) => {
    const componentValue = value[component];
    if (typeof componentValue !== 'number' || Number.isNaN(componentValue)) {
      throw new Error(`Parameter '${id}' expects numeric ${component} value`);
    }
    if (componentValue < 0 || componentValue > 1) {
      throw new Error(`Parameter '${id}': ${RGB_RANGE_ERROR} (received ${component}: ${componentValue})`);
    }
  };

  ensure('red');
  ensure('green');
  ensure('blue');
}

function validateColorValue(id: string, colorValue: ColorValue): void {
  if (colorValue.mode === ColorMode.HSL) {
    validateHslValue(id, colorValue.hsl);
  } else if (colorValue.mode === ColorMode.RGB) {
    validateRgbFloatValue(id, colorValue.rgb);
  } else {
    throw new Error(`Parameter '${id}': unknown color mode`);
  }
}

function cloneColorValue(cv: ColorValue): ColorValue {
  if (cv.mode === ColorMode.HSL) {
    return { mode: ColorMode.HSL, hsl: { ...cv.hsl } };
  }
  return { mode: ColorMode.RGB, rgb: { red: cv.rgb.red, green: cv.rgb.green, blue: cv.rgb.blue } };
}

/** Deep-clone a parameter value (primitives pass through, objects/arrays are structurally cloned). */
function cloneParameterValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

/** Structural deep equality for parameter values. */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => deepEquals(val, b[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj);
  if (keysA.length !== Object.keys(bObj).length) return false;
  return keysA.every((key) => key in bObj && deepEquals(aObj[key], bObj[key]));
}

/**
 * Interface for UI-focused parameter operations
 * Provides read and write access to parameter values without registration or listener management
 */
export interface EffectParameterView {
  /**
   * Get all registered parameters
   * @returns Array of all parameters with default-tracking
   */
  list(): RegisteredParameter[];

  /**
   * Set a new value for a parameter with validation
   * @param id The ID of the parameter to update
   * @param value The new value to set
   * @throws Error if parameter not found or validation fails
   */
  setValue(id: string, value: ParameterValue): void;
}

/**
 * Initialize the non-enumerable `color`/`colors` field on a color parameter.
 * Non-enumerable so it is excluded from JSON serialization (backend-internal).
 */
function initColorFields(parameter: EffectParameter): void {
  if (parameter.type === ParameterType.HSL) {
    Object.defineProperty(parameter, 'color', {
      value: new HslColor(parameter.value),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } else if (parameter.type === ParameterType.MULTI_HSL) {
    Object.defineProperty(parameter, 'colors', {
      value: parameter.value.map((hsl) => new HslColor(hsl)),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } else if (parameter.type === ParameterType.RGB) {
    Object.defineProperty(parameter, 'color', {
      value: new RgbColor(parameter.value),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } else if (parameter.type === ParameterType.COLOR) {
    const colorValue = parameter.value;
    Object.defineProperty(parameter, 'color', {
      value: colorValue.mode === ColorMode.HSL ? new HslColor(colorValue.hsl) : new RgbColor(colorValue.rgb),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } else if (parameter.type === ParameterType.MULTI_COLOR) {
    Object.defineProperty(parameter, 'colors', {
      value: parameter.value.map((cv) => (cv.mode === ColorMode.HSL ? new HslColor(cv.hsl) : new RgbColor(cv.rgb))),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
}

/**
 * Update the `color`/`colors` field after a value change.
 */
function updateColorField(parameter: EffectParameter): void {
  if (parameter.type === ParameterType.HSL) {
    parameter.color = new HslColor(parameter.value);
  } else if (parameter.type === ParameterType.MULTI_HSL) {
    parameter.colors = parameter.value.map((hsl) => new HslColor(hsl));
  } else if (parameter.type === ParameterType.RGB) {
    parameter.color = new RgbColor(parameter.value);
  } else if (parameter.type === ParameterType.COLOR) {
    const colorValue = parameter.value;
    parameter.color = colorValue.mode === ColorMode.HSL ? new HslColor(colorValue.hsl) : new RgbColor(colorValue.rgb);
  } else if (parameter.type === ParameterType.MULTI_COLOR) {
    parameter.colors = parameter.value.map((cv) =>
      cv.mode === ColorMode.HSL ? new HslColor(cv.hsl) : new RgbColor(cv.rgb)
    );
  }
}

export class EffectParameterStorage implements EffectParameterView {
  private parameters: Map<string, EffectParameter> = new Map();
  private listeners: Map<string, ParameterChangeListener> = new Map();

  /**
   * Register a new parameter in the storage.
   * For HSL, RGB, and MULTI_HSL parameters, the `color`/`colors` field is populated automatically.
   */
  register(
    parameter: Omit<HslEffectParameter, 'color'>,
    listener?: ParameterChangeListener<HslEffectParameter>
  ): WithDefault<HslEffectParameter>;
  register(
    parameter: Omit<RgbEffectParameter, 'color'>,
    listener?: ParameterChangeListener<RgbEffectParameter>
  ): WithDefault<RgbEffectParameter>;
  register(
    parameter: Omit<ColorEffectParameter, 'color'>,
    listener?: ParameterChangeListener<ColorEffectParameter>
  ): WithDefault<ColorEffectParameter>;
  register(
    parameter: Omit<MultiColorEffectParameter, 'colors'>,
    listener?: ParameterChangeListener<MultiColorEffectParameter>
  ): WithDefault<MultiColorEffectParameter>;
  register(
    parameter: Omit<MultiHslEffectParameter, 'colors'>,
    listener?: ParameterChangeListener<MultiHslEffectParameter>
  ): WithDefault<MultiHslEffectParameter>;
  register<T extends EffectParameter>(parameter: T, listener?: ParameterChangeListener<T>): WithDefault<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(parameter: any, listener?: any): any {
    if (this.parameters.has(parameter.id)) {
      throw new Error(`Parameter with id '${parameter.id}' is already registered`);
    }
    // Capture default value before any mutations
    const defaultValue = cloneParameterValue(parameter.value);
    parameter.isDefault = () => deepEquals(parameter.value, defaultValue);
    initColorFields(parameter);
    this.parameters.set(parameter.id, parameter);
    if (listener) {
      this.listeners.set(parameter.id, listener as ParameterChangeListener);
    }
    return parameter;
  }

  /**
   * Unregister an existing parameter from the storage
   * @param id The ID of the parameter to unregister
   * @returns true if the parameter was found and removed, false otherwise
   */
  unregister(id: string): boolean {
    this.listeners.delete(id);
    return this.parameters.delete(id);
  }

  /**
   * Get all registered parameters
   * @returns Array of all parameters with default-tracking
   */
  list(): RegisteredParameter[] {
    return Array.from(this.parameters.values()) as RegisteredParameter[];
  }

  /**
   * Get a specific parameter by ID
   * @param id The ID of the parameter to retrieve
   * @returns The parameter or undefined if not found
   */
  get(id: string): EffectParameter | undefined {
    return this.parameters.get(id);
  }

  /**
   * Set a new value for a parameter with validation
   * @param id The ID of the parameter to update
   * @param value The new value to set
   * @throws Error if parameter not found or validation fails
   */
  setValue(id: string, value: ParameterValue): void {
    const parameter = this.parameters.get(id);

    if (!parameter) {
      throw new Error(`Parameter with id '${id}' not found`);
    }

    const oldValue = parameter.value;

    // Validate and set based on parameter type
    if (parameter.type === ParameterType.RANGE) {
      if (typeof value !== 'number') {
        throw new Error(`Parameter '${id}' expects a number value`);
      }
      if (value < parameter.min || value > parameter.max) {
        throw new Error(`Value ${value} is out of range [${parameter.min}, ${parameter.max}] for parameter '${id}'`);
      }
      parameter.value = value;
    } else if (parameter.type === ParameterType.BOOLEAN) {
      if (typeof value !== 'boolean') {
        throw new Error(`Parameter '${id}' expects a boolean value`);
      }
      parameter.value = value;
    } else if (parameter.type === ParameterType.HSL) {
      if (typeof value !== 'object') {
        throw new Error(`Parameter '${id}' expects an HSL value`);
      }
      const hslValue = value as Hsl;
      validateHslValue(id, hslValue);
      parameter.value = { ...hslValue };
      updateColorField(parameter);
    } else if (parameter.type === ParameterType.OPTION) {
      if (typeof value !== 'string') {
        throw new Error(`Parameter '${id}' expects a string value`);
      }
      if (!parameter.options.some((opt) => opt.value === value)) {
        const allowed = parameter.options.map((opt) => opt.value).join(', ');
        throw new Error(`Value '${value}' is not a valid option for parameter '${id}'. Allowed: ${allowed}`);
      }
      parameter.value = value;
    } else if (parameter.type === ParameterType.MULTI_HSL) {
      if (!Array.isArray(value)) {
        throw new Error(`Parameter '${id}' expects an array of HSL values`);
      }
      if (value.length < 1) {
        throw new Error(`Parameter '${id}' requires at least one HSL color`);
      }
      const hslValues = value as Hsl[];
      for (const hsl of hslValues) {
        validateHslValue(id, hsl);
      }
      parameter.value = hslValues.map((hsl) => ({ ...hsl }));
      updateColorField(parameter);
    } else if (parameter.type === ParameterType.RGB) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Parameter '${id}' expects an RGB value`);
      }
      const rgbValue = value as RgbFloat;
      validateRgbFloatValue(id, rgbValue);
      parameter.value = { red: rgbValue.red, green: rgbValue.green, blue: rgbValue.blue };
      updateColorField(parameter);
    } else if (parameter.type === ParameterType.COLOR) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Parameter '${id}' expects a ColorValue object`);
      }
      const colorValue = value as ColorValue;
      validateColorValue(id, colorValue);
      parameter.value = cloneColorValue(colorValue);
      updateColorField(parameter);
    } else if (parameter.type === ParameterType.MULTI_COLOR) {
      if (!Array.isArray(value)) {
        throw new Error(`Parameter '${id}' expects an array of ColorValue objects`);
      }
      if (value.length < 1) {
        throw new Error(`Parameter '${id}' requires at least one color`);
      }
      const colorValues = value as ColorValue[];
      for (const cv of colorValues) {
        validateColorValue(id, cv);
      }
      parameter.value = colorValues.map(cloneColorValue);
      updateColorField(parameter);
    }

    // Invoke listener asynchronously (fire-and-forget) if registered
    const listener = this.listeners.get(id);
    if (listener && oldValue !== value) {
      Promise.resolve(listener(parameter, oldValue, value)).catch((error) => {
        console.error(`Error in listener for parameter '${id}':`, error);
      });
    }
  }

  /**
   * Check if a parameter with the given ID exists
   * @param id The ID to check
   * @returns true if the parameter exists, false otherwise
   */
  has(id: string): boolean {
    return this.parameters.has(id);
  }

  /**
   * Clear all registered parameters
   */
  clear(): void {
    this.parameters.clear();
    this.listeners.clear();
  }

  /**
   * Get the count of registered parameters
   * @returns The number of registered parameters
   */
  get count(): number {
    return this.parameters.size;
  }
}

export class MultiParameterStorageView implements EffectParameterView {
  constructor(private prefixToStorageMap: Map<string, EffectParameterView>) {}
  list(): RegisteredParameter[] {
    const allParameters: RegisteredParameter[] = [];
    for (const [prefix, storage] of this.prefixToStorageMap.entries()) {
      allParameters.push(...storage.list().map((param) => ({ ...param, id: `${prefix}${param.id}` })));
    }
    return allParameters;
  }
  setValue(id: string, value: ParameterValue): void {
    for (const [prefix, storage] of this.prefixToStorageMap.entries()) {
      if (id.startsWith(prefix)) {
        const paramId = id.substring(prefix.length);
        storage.setValue(paramId, value);
        return;
      }
    }
    throw new Error(`Parameter with id '${id}' not found in any storage`);
  }
}

export const emptyParameterStorageView: EffectParameterView = {
  list(): RegisteredParameter[] {
    return [];
  },
  setValue(id: string, value: ParameterValue): void {
    throw new Error(`No parameters available`);
  },
};

export class DynamicParameterStorageView implements EffectParameterView {
  constructor(private getCurrentStorage: () => EffectParameterView) {}
  list(): RegisteredParameter[] {
    return this.getCurrentStorage().list();
  }
  setValue(id: string, value: ParameterValue): void {
    this.getCurrentStorage().setValue(id, value);
  }
}
