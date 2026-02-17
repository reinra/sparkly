import {
  EffectParameterStorage,
  EffectParameterView,
  emptyParameterStorageView,
  MultiParameterStorageView,
  ParameterValue,
} from './effectParameters';
import { BaseSameColorEffect, Effect, EffectPreset, LedPoint1D, LedPoint2D, LedPoint } from './effects/Effect';
import { BooleanEffectParameter, OptionEffectParameter, ParameterType, RangeEffectParameter } from './ParameterTypes';

export const enum MappingMode {
  UseXAsPosition = 'UseXAsPosition',
  UseYAsPosition = 'UseYAsPosition',
  UseDistanceAsPosition = 'UseDistanceAsPosition',
}

export const enum Rotation {
  Deg0 = '0',
  Deg90 = '90',
  Deg180 = '180',
  Deg270 = '270',
}

const WRAPPER_PREFIX = 'wrapper.';
const CUSTOM_PREFIX = 'custom.';

export class EffectWrapper {
  private readonly parameters = new EffectParameterStorage();
  private readonly speed: RangeEffectParameter = this.parameters.register({
    id: 'speed',
    name: 'Speed',
    description: 'Global speed multiplier for effects',
    type: ParameterType.RANGE,
    value: 1.0,
    min: 0.0,
    max: 5.0,
    unit: 'x',
    step: 0.1,
  });
  private readonly mappingMode: OptionEffectParameter = this.parameters.register(
    {
      id: 'mode',
      name: 'Mapping Mode',
      description: 'Mode for mapping 1D effect to 2D',
      type: ParameterType.OPTION,
      value: MappingMode.UseDistanceAsPosition,
      options: [
        {
          value: MappingMode.UseDistanceAsPosition,
          label: 'Sequence',
          description: 'Map the distance from center (0-1) to the 1D effect position',
        },
        {
          value: MappingMode.UseXAsPosition,
          label: 'Horizontal',
          description: 'Map the X coordinate (0-1) to the 1D effect position',
        },
        {
          value: MappingMode.UseYAsPosition,
          label: 'Vertical',
          description: 'Map the Y coordinate (0-1) to the 1D effect position',
        },
      ],
    },
    () => {
      for (const listener of this.mappingModeChangeListeners) {
        listener();
      }
    }
  );
  private readonly gamma: RangeEffectParameter = this.parameters.register({
    id: 'gamma',
    name: 'Gamma correction',
    description: 'Gamma correction value for this effect (multiplied with device gamma)',
    type: ParameterType.RANGE,
    value: 1.0,
    min: 0.1,
    max: 4.0,
    step: 0.1,
  });
  private readonly rotation: OptionEffectParameter = this.parameters.register({
    id: 'rotation',
    name: 'Rotation',
    description: 'Rotate the 2D effect by a fixed angle',
    type: ParameterType.OPTION,
    value: Rotation.Deg0,
    options: [
      { value: Rotation.Deg0, label: '0°', description: 'No rotation' },
      { value: Rotation.Deg90, label: '90°', description: 'Rotate 90 degrees clockwise' },
      { value: Rotation.Deg180, label: '180°', description: 'Rotate 180 degrees' },
      { value: Rotation.Deg270, label: '270°', description: 'Rotate 270 degrees clockwise' },
    ],
  });
  private readonly mirror: BooleanEffectParameter = this.parameters.register({
    id: 'mirror',
    name: 'Mirror effect',
    description: 'Reverse the effect direction for this effect',
    type: ParameterType.BOOLEAN,
    value: false,
  });
  private readonly invertColors: BooleanEffectParameter = this.parameters.register({
    id: 'invertColors',
    name: 'Invert colors',
    description: 'Invert the RGB color output of this effect',
    type: ParameterType.BOOLEAN,
    value: false,
  });
  private readonly ledsPerPixel: RangeEffectParameter = this.parameters.register(
    {
      id: 'ledsPerPixel',
      name: 'Leds per pixel',
      description: 'Number of consecutive LEDs that share the same position (same color)',
      type: ParameterType.RANGE,
      value: 1,
      min: 1,
      max: 100,
      step: 1,
    },
    () => {
      for (const listener of this.mappingModeChangeListeners) {
        listener();
      }
    }
  );
  private readonly mappingModeChangeListeners = new Set<() => void>();

  constructor(
    public readonly id: string,
    public readonly effect: Effect<any>,
    private readonly name: string
  ) {
    const saemColorEffect = effect instanceof BaseSameColorEffect;
    this.speed.hidden = effect.isStatic === true;
    this.mappingMode.hidden = effect.pointType === '2D' || saemColorEffect;
    this.rotation.hidden = effect.pointType !== '2D';
    this.mirror.hidden = saemColorEffect;
    this.ledsPerPixel.hidden = effect.pointType === '2D' || saemColorEffect;
  }

  public getName(): string {
    return this.name;
  }

  public addMappingModeChangeListener(listener: () => void): void {
    this.mappingModeChangeListeners.add(listener);
  }

  public removeMappingModeChangeListener(listener: () => void): void {
    this.mappingModeChangeListeners.delete(listener);
  }

  public async computePoints1D(count: number, getPoints2D: () => Promise<LedPoint2D[]>): Promise<LedPoint1D[]> {
    const mode = this.mappingMode.value as MappingMode;
    if (mode === MappingMode.UseDistanceAsPosition) {
      return EffectWrapper.getSimplePoints1D(count, this.ledsPerPixel.value);
    }
    const points = await getPoints2D();
    const lpp = this.ledsPerPixel.value;
    return points.map((point) => ({
      id: point.id,
      position: Math.floor(point.id / lpp),
      distance: getDistance(mode, point, count),
    }));
  }

  private static getSimplePoints1D(count: number, ledsPerPixel: number): LedPoint1D[] {
    const points: LedPoint1D[] = [];
    for (let i = 0; i < count; i++) {
      points.push({ id: i, position: Math.floor(i / ledsPerPixel), distance: i / count });
    }
    return points;
  }

  public getEffectParameters(): EffectParameterView {
    if (this.effect.parameters) {
      return new MultiParameterStorageView(
        new Map<string, EffectParameterView>([
          [WRAPPER_PREFIX, this.parameters],
          [CUSTOM_PREFIX, this.effect.parameters],
        ])
      );
    }
    return this.parameters;
  }
  public getCurrentSpeedMultiplier(): number {
    return this.speed.value;
  }
  public getGamma(): number {
    return this.gamma.value;
  }
  public getMirror(): boolean {
    return this.mirror.value;
  }
  public getInvertColors(): boolean {
    return this.invertColors.value;
  }
  public getRotation(): Rotation {
    return this.rotation.value as Rotation;
  }

  /**
   * Rotate 2D points around the center (0.5, 0.5) of the normalized coordinate space.
   */
  public static rotatePoints2D(points: LedPoint2D[], rotation: Rotation): LedPoint2D[] {
    if (rotation === Rotation.Deg0) return points;
    return points.map((p) => {
      switch (rotation) {
        case Rotation.Deg90:
          return { id: p.id, x: 1 - p.y, y: p.x };
        case Rotation.Deg180:
          return { id: p.id, x: 1 - p.x, y: 1 - p.y };
        case Rotation.Deg270:
          return { id: p.id, x: p.y, y: 1 - p.x };
        default:
          return p;
      }
    });
  }

  /**
   * Create a clone of this EffectWrapper with a new ID and name.
   * A fresh effect instance is created and all parameter values are copied.
   */
  public clone(newId: string, newName: string): EffectWrapper {
    const newEffect = new (this.effect.constructor as new () => Effect<LedPoint>)();
    const cloned = new EffectWrapper(newId, newEffect, newName);
    // Copy all parameter values from source to clone
    for (const param of this.getEffectParameters().list()) {
      cloned.getEffectParameters().setValue(param.id, param.value);
    }
    return cloned;
  }
}

function getDistance(mode: MappingMode, point: LedPoint2D, count: number): number {
  switch (mode) {
    case MappingMode.UseXAsPosition:
      return point.x;
    case MappingMode.UseYAsPosition:
      return point.y;
    case MappingMode.UseDistanceAsPosition:
      return point.id / count;
  }
  throw new Error('Unreachable');
}

export function createPresetFactoryForSingleParameter(
  parameterId: string
): (id: string, name: string, value: ParameterValue) => EffectPreset {
  return (id: string, name: string, value: ParameterValue) => ({
    id,
    name,
    config: new Map([[CUSTOM_PREFIX + parameterId, value]]),
  });
}
