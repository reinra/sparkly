import { BooleanEffectParameter, ParameterType, RangeEffectParameter } from '@twinkly-ts/common/dist/types';
import { GestaltResponseType, TwinklyApiClient } from './deviceClient/apiClient';
import {
  DynamicParameterStorageView,
  EffectParameterStorage,
  EffectParameterView,
  emptyParameterStorageView,
  MultiParameterStorageView,
} from './effectParameters';
import { adjustColorTemperatureNormalized, floatTo8bit, gammaCorrect, RgbFloat } from './color/ColorFloat';
import { RgbValue } from './color/Color8bit';
import { Effect, StatelessEffect } from './effects/generic/Effect';
import { IdentityLedMapper, LedMapper, ReverseLedMapper, SegmentedLedMapper } from './render/LedMapper';
import { EnabledDisabledSchema } from './deviceClient/apiContract';

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
  private deviceParamsInitialized = false;
  private currentEffect: Effect<any> | null = null;
  private allParams = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['device.', this.deviceParams],
      ['effect.', new DynamicParameterStorageView(() => this.getCurrentEffectParameters())],
    ])
  );

  private getCurrentEffectParameters(): EffectParameterView {
    if (this.currentEffect && this.currentEffect.parameters) {
      return this.currentEffect.parameters;
    }
    return emptyParameterStorageView;
  }

  private readonly speed: RangeEffectParameter = {
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
  private readonly maxFps: RangeEffectParameter = {
    id: 'fps',
    name: 'Max rendering frequency',
    description: 'Maximum frames per second for effect rendering',
    type: ParameterType.RANGE,
    value: 60,
    min: 1,
    max: 60,
    unit: 'fps',
  };
  private readonly gamma: RangeEffectParameter = {
    id: 'gamma',
    name: 'Gamma correction',
    description: 'Gamma correction value for brightness adjustment',
    type: ParameterType.RANGE,
    value: 2.2, // Default gamma
    min: 0.1,
    max: 4.0,
    step: 0.1,
  };
  private readonly temperature: RangeEffectParameter = {
    id: 'temperature',
    name: 'Color Temperature',
    description: 'Color temperature adjustment for effects, where -1 is cool/blue, 0 is neutral, and 1 is warm/orange',
    type: ParameterType.RANGE,
    value: 0, // No adjustment by default
    min: -1,
    max: 1,
    step: 0.1,
  };
  private readonly mirror: BooleanEffectParameter = {
    id: 'mirror',
    name: 'Mirror LEDs',
    description: 'Whether to reverse the effect direction over LEDs (if applicable',
    type: ParameterType.BOOLEAN,
    value: false,
  };

  public constructor(public readonly apiClient: TwinklyApiClient) {}

  public async refreshFromDevice(): Promise<void> {
    await this.ensureParams();
  }

  private async ensureParams(): Promise<void> {
    if (this.deviceParamsInitialized) {
      return;
    }

    this.deviceParams.register(
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
      async (_parameter, _oldValue, newValue) => {
        await this.apiClient.setBrightnessAbsolute(newValue);
      }
    );

    this.deviceParams.register(
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
      async (_parameter, _oldValue, newValue) => {
        await this.apiClient.setSaturationAbsolute(newValue);
      }
    );

    this.maxFps.value = (await this.getGestalt()).frame_rate;

    this.deviceParams.register(this.maxFps);
    this.deviceParams.register(this.speed);
    this.deviceParams.register(this.mirror);
    this.deviceParams.register(this.gamma);
    this.deviceParams.register(this.temperature);

    this.deviceParamsInitialized = true;
  }

  public async getParameters(): Promise<EffectParameterView> {
    await this.ensureParams();
    return this.allParams;
  }

  public async getFilterValue(name: string): Promise<number | undefined> {
    return (await this.apiClient.getSummary()).filters?.find(
      (filter) => filter.filter == name && filter.config.mode === EnabledDisabledSchema.Values.enabled
    )?.config?.value;
  }

  public getCurrentSpeedMultiplier(): number {
    return this.speed.value;
  }
  public getMaxFps(): number {
    return this.maxFps.value;
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
    const gamma = this.gamma.value;
    const temperature = this.temperature.value;
    const result: RgbValue[] = new Array(colors.length);
    for (let i = 0; i < colors.length; i++) {
      result[i] = floatTo8bit(adjustColorTemperatureNormalized(gammaCorrect(colors[i], gamma), temperature));
    }
    return result;
  }

  public async getLedMapper(fixStringsIfNeeded: boolean): Promise<LedMapper> {
    const ledConfig = await this.apiClient.getLedConfig();

    let mapper: LedMapper = new IdentityLedMapper();
    if (fixStringsIfNeeded && ledConfig.strings.length === 2) {
      const halfLength = ledConfig.strings[0].length;
      mapper = new SegmentedLedMapper([
        { startIndex: 0, mapper: new ReverseLedMapper(halfLength) },
        { startIndex: halfLength, mapper: new IdentityLedMapper() },
      ]);
    }
    const reverseMapper = new ReverseLedMapper((await this.getGestalt()).number_of_led, mapper);

    return {
      mapLedIndex: (index: number) => {
        return this.mirror.value === true ? reverseMapper.mapLedIndex(index) : mapper.mapLedIndex(index);
      },
    };
  }

  setCurrentEffect(effect: Effect<any> | null) {
    this.currentEffect = effect;
  }

  public async getDebugInfo(): Promise<{ title: string; content: any }[]> {
    return [
      {
        title: 'Gestalt',
        content: await this.apiClient.gestalt(),
      },
      {
        title: 'Summary',
        content: await this.apiClient.getSummary(),
      },
      {
        title: 'LED Config',
        content: await this.apiClient.getLedConfig(),
      },
      {
        title: 'Movie Config',
        content: await this.apiClient.getLedMovieConfig(),
      },
      {
        title: 'Effects',
        content: await this.apiClient.getLedEffects(),
      }
    ];
  }
}
