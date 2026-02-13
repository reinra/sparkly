import type { EffectParameter, RangeEffectParameter, BooleanEffectParameter, HslEffectParameter, OptionEffectParameter, Hsl } from './ParameterTypes';
import { ParameterType } from './ParameterTypes';

type ParameterValueType<T extends EffectParameter> =
  T extends RangeEffectParameter ? number :
  T extends BooleanEffectParameter ? boolean :
  T extends HslEffectParameter ? Hsl :
  T extends OptionEffectParameter ? string :
  never;

export type ParameterChangeListener<T extends EffectParameter = EffectParameter> = (
  parameter: T,
  oldValue: ParameterValueType<T>,
  newValue: ParameterValueType<T>
) => void | Promise<void>;

export type ParameterValue = number | boolean | Hsl | string;

const HSL_RANGE_ERROR = `HSL components must be between 0 and 1 inclusive`;

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

/**
 * Interface for UI-focused parameter operations
 * Provides read and write access to parameter values without registration or listener management
 */
export interface EffectParameterView {
  /**
   * Get all registered parameters
   * @returns Array of all parameters
   */
  list(): EffectParameter[];

  /**
   * Set a new value for a parameter with validation
   * @param id The ID of the parameter to update
   * @param value The new value to set
   * @throws Error if parameter not found or validation fails
   */
  setValue(id: string, value: ParameterValue): void;
}

export class EffectParameterStorage implements EffectParameterView {
  private parameters: Map<string, EffectParameter> = new Map();
  private listeners: Map<string, ParameterChangeListener> = new Map();

  /**
   * Register a new parameter in the storage
   * @param parameter The parameter to register
   * @param listener Optional callback invoked asynchronously when the parameter value changes
   * @throws Error if a parameter with the same ID already exists
   */
  register<T extends EffectParameter>(parameter: T, listener?: ParameterChangeListener<T>): T {
    if (this.parameters.has(parameter.id)) {
      throw new Error(`Parameter with id '${parameter.id}' is already registered`);
    }
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
   * @returns Array of all parameters
   */
  list(): EffectParameter[] {
    return Array.from(this.parameters.values());
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
    } else if (parameter.type === ParameterType.OPTION) {
      if (typeof value !== 'string') {
        throw new Error(`Parameter '${id}' expects a string value`);
      }
      if (!parameter.options.some((opt) => opt.value === value)) {
        const allowed = parameter.options.map((opt) => opt.value).join(', ');
        throw new Error(`Value '${value}' is not a valid option for parameter '${id}'. Allowed: ${allowed}`);
      }
      parameter.value = value;
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
  list(): EffectParameter[] {
    const allParameters: EffectParameter[] = [];
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
  list(): EffectParameter[] {
    return [];
  },
  setValue(id: string, value: ParameterValue): void {
    throw new Error(`No parameters available`);
  },
};

export class DynamicParameterStorageView implements EffectParameterView {
  constructor(private getCurrentStorage: () => EffectParameterView) {}
  list(): EffectParameter[] {
    return this.getCurrentStorage().list();
  }
  setValue(id: string, value: ParameterValue): void {
    this.getCurrentStorage().setValue(id, value);
  }
}
