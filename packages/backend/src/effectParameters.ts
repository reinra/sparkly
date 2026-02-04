import type { EffectParameter, RangeEffectParameter, BooleanEffectParameter } from '@twinkly-ts/common';
import { ParameterType } from '@twinkly-ts/common';

export type RangeParameterChangeListener = (
  parameter: RangeEffectParameter,
  oldValue: number,
  newValue: number
) => void | Promise<void>;
export type BooleanParameterChangeListener = (
  parameter: BooleanEffectParameter,
  oldValue: boolean,
  newValue: boolean
) => void | Promise<void>;
export type ParameterChangeListener = RangeParameterChangeListener | BooleanParameterChangeListener;

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
  setValue(id: string, value: number | boolean): void;
}

export class EffectParameterStorage implements EffectParameterView {
  private parameters: Map<string, EffectParameter> = new Map();
  private listeners: Map<string, ParameterChangeListener> = new Map();

  /**
   * Register a new range parameter in the storage
   * @param parameter The range parameter to register
   * @param listener Optional type-safe callback invoked asynchronously when the parameter value changes
   * @throws Error if a parameter with the same ID already exists
   */
  register(parameter: RangeEffectParameter, listener?: RangeParameterChangeListener): void;

  /**
   * Register a new boolean parameter in the storage
   * @param parameter The boolean parameter to register
   * @param listener Optional type-safe callback invoked asynchronously when the parameter value changes
   * @throws Error if a parameter with the same ID already exists
   */
  register(parameter: BooleanEffectParameter, listener?: BooleanParameterChangeListener): void;

  register(parameter: EffectParameter, listener?: ParameterChangeListener): void {
    if (this.parameters.has(parameter.id)) {
      throw new Error(`Parameter with id '${parameter.id}' is already registered`);
    }
    this.parameters.set(parameter.id, parameter);
    if (listener) {
      this.listeners.set(parameter.id, listener);
    }
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
  setValue(id: string, value: number | boolean): void {
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
    }

    // Invoke listener asynchronously (fire-and-forget) if registered
    const listener = this.listeners.get(id);
    if (listener && oldValue !== value) {
      if (parameter.type === ParameterType.RANGE) {
        const rangeListener = listener as RangeParameterChangeListener;
        Promise.resolve(rangeListener(parameter as RangeEffectParameter, oldValue as number, value as number)).catch(
          (error) => {
            console.error(`Error in listener for parameter '${id}':`, error);
          }
        );
      } else {
        const booleanListener = listener as BooleanParameterChangeListener;
        Promise.resolve(
          booleanListener(parameter as BooleanEffectParameter, oldValue as boolean, value as boolean)
        ).catch((error) => {
          console.error(`Error in listener for parameter '${id}':`, error);
        });
      }
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
