import { ParameterType } from '@twinkly-ts/common/dist/types';
import { GestaltResponseType, TwinklyApiClient } from './deviceClient/apiClient';
import { EffectParameterStorage, EffectParameterView } from './effectParameters';

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
  private deviceParams = new EffectParameterStorage();

  public constructor(public readonly apiClient: TwinklyApiClient) {}

  public async refrehFromDevice(): Promise<void> {
    this.deviceParams.register({
      id: 'brightness',
      name: 'Brightness',
      description: 'Current brightness of LEDs regardless of mode, not shown in previews',
      type: ParameterType.RANGE,
      value: (await this.getAbsoluteBrightness()) ?? 100,
      min: 0,
      max: 100,
    });
  }

  public get parameters(): EffectParameterView {
    return this.deviceParams;
  }

  public async getAbsoluteBrightness(): Promise<number | undefined> {
    return (await this.apiClient.getSummary()).filters?.find((filter) => filter.filter == 'brightness')?.config?.value;
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
}
