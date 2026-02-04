import { ParameterType, RangeEffectParameter } from '@twinkly-ts/common/dist/types';
import { GestaltResponseType, TwinklyApiClient } from './deviceClient/apiClient';
import { EffectParameterStorage, EffectParameterView } from './effectParameters';
import { floatTo8bit, RgbFloat } from './color/ColorFloat';
import { RgbValue } from './color/Color8bit';

export interface LedMapping {
  coordinates: LedCoordinates[];
}
export interface LedCoordinates {
  id: number; // LED index
  x: number; // 0...1
  y: number; // 0...1
}

export class DeviceHelper {
  private ledMappingCache: LedMapping | null = null;
  private gestaltCache: GestaltResponseType | null = null;
  private params = new EffectParameterStorage();
  private paramsInitialized = false;

  private readonly speedParameter: RangeEffectParameter = {
    id: 'speed',
    name: 'Speed',
    description: 'Global speed multiplier for effects',
    type: ParameterType.RANGE,
    value: 1.0,
    min: 0.0,
    max: 5.0,
    unit: 'x',
    step: 0.1,
  };
  private readonly maxFpsParameter: RangeEffectParameter = {
    id: 'fps',
    name: 'Max rendering frequency',
    description: 'Maximum frames per second for effect rendering',
    type: ParameterType.RANGE,
    value: 60,
    min: 1,
    max: 60,
    unit: 'fps',
  };

  public constructor(public readonly apiClient: TwinklyApiClient) {}

  public async refreshFromDevice(): Promise<void> {
    await this.ensureParams();
  }

  private async ensureParams(): Promise<void> {
    if (this.paramsInitialized) {
      return;
    }

    this.params.register(
      {
        id: 'brightness',
        name: 'Brightness',
        description: 'Current brightness of LEDs regardless of mode, not shown in previews',
        type: ParameterType.RANGE,
        value: (await this.getFilterValue('brightness')) ?? 100,
        min: 0,
        max: 100,
        unit: '%',
        step: 1,
      },
      async (_parameter, _oldValue, newValue: number) => {
        await this.apiClient.setBrightnessAbsolute(newValue);
      }
    );

    this.params.register(
      {
        id: 'saturation',
        name: 'Saturation',
        description: 'Current saturation of LEDs regardless of mode, not shown in previews',
        type: ParameterType.RANGE,
        value: (await this.getFilterValue('saturation')) ?? 100,
        min: 0,
        max: 100,
        unit: '%',
        step: 1,
      },
      async (_parameter, _oldValue, newValue: number) => {
        await this.apiClient.setSaturationAbsolute(newValue);
      }
    );

    this.params.register(this.speedParameter);

    this.maxFpsParameter.value = (await this.getGestalt()).frame_rate;
    this.params.register(this.maxFpsParameter);

    this.paramsInitialized = true;
  }

  public async getParameters(): Promise<EffectParameterView> {
    await this.ensureParams();
    return this.params;
  }

  public async getFilterValue(name: string): Promise<number | undefined> {
    return (await this.apiClient.getSummary()).filters?.find((filter) => filter.filter == name)?.config?.value;
  }

  public getCurrentSpeedMultiplier(): number {
    return this.speedParameter.value;
  }
  public getMaxFps(): number {
    return this.maxFpsParameter.value;
  }
  public getMinFrameTimeMs(): number {
    return 1000 / this.getMaxFps();
  }

  public async getGestalt(): Promise<GestaltResponseType> {
    if (this.gestaltCache) {
      return this.gestaltCache;
    }
    this.gestaltCache = await this.apiClient.gestalt();
    return this.gestaltCache;
  }

  public async getLedMapping(): Promise<LedMapping> {
    if (this.ledMappingCache) {
      return this.ledMappingCache;
    }
    const layout = await this.apiClient.getLayout();

    // Find min/max for normalization
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const led of layout.coordinates) {
      minX = Math.min(minX, led.x);
      maxX = Math.max(maxX, led.x);
      minY = Math.min(minY, led.y);
      maxY = Math.max(maxY, led.y);
    }

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // Normalize coordinates to 0...1
    const points: LedCoordinates[] = [];
    let i = 0;
    for (const led of layout.coordinates) {
      const normalizedX = rangeX > 0 ? (led.x - minX) / rangeX : 0;
      const normalizedY = rangeY > 0 ? (led.y - minY) / rangeY : 0;
      points.push({ id: i, x: normalizedX, y: normalizedY });
      i++;
    }
    this.ledMappingCache = { coordinates: points };
    return this.ledMappingCache;
  }

  public floatTo8bitColor(colors: RgbFloat[]): RgbValue[] {
    const result: RgbValue[] = new Array(colors.length);
    for (let i = 0; i < colors.length; i++) {
      result[i] = floatTo8bit(colors[i]);
    }
    return result;
  }
}
