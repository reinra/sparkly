import {
  BooleanEffectParameter,
  EffectParameter,
  ParameterGroup,
  ParameterType,
  RangeEffectParameter,
} from './ParameterTypes';
import { GestaltResponseType, TwinklyApiClient, type DeviceModeType } from './deviceClient/ApiClient';
import {
  DynamicParameterStorageView,
  EffectParameterStorage,
  EffectParameterView,
  emptyParameterStorageView,
  MultiParameterStorageView,
} from './EffectParameters';
import {
  adjustColorTemperatureNormalized,
  applyChannelGain,
  floatTo8bit,
  gammaCorrect,
  RgbFloat,
} from './color/ColorFloat';
import { Rgb24 } from './color/Color8bit';
import { type AnyEffect, LedPoint1D, LedPoint2D } from './effects/Effect';
import { IdentityLedMapper, LedMapper, ReverseLedMapper, SegmentedLedMapper } from './render/LedMapper';
import { DeviceModeSchema, EnabledDisabledSchema } from './deviceClient/ApiContract';
import { EffectWrapper } from './EffectWrapper';
import type { FrameBuffer } from './render/FrameOutputStream';

export interface LedMapping {
  coordinates: LedCoordinates[];
}
export interface LedCoordinates {
  id: number; // LED index
  x: number; // 0...1
  y: number; // 0...1
}

const DEVICE_PREFIX = 'device.';
const EFFECT_PREFIX = 'effect.';

export function getEffectGroup(parameter: EffectParameter): ParameterGroup {
  if (parameter.id.startsWith(DEVICE_PREFIX)) {
    return ParameterGroup.DEVICE;
  }
  if (parameter.id.startsWith(EFFECT_PREFIX)) {
    return ParameterGroup.EFFECT;
  }
  throw new Error(`Unknown parameter group for parameter ID: ${parameter.id}`);
}

export enum ConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
}

export class DeviceHelper {
  public readonly buffer: FrameBuffer = { base64_encoded: null, phase: null };

  private ledMappingCache: LedMapping | null = null;
  private gestaltCache: GestaltResponseType | null = null;
  private deviceParams = new EffectParameterStorage();
  private deviceConnected = false;
  private currentEffect: EffectWrapper | null = null;
  private points1DCache: LedPoint1D[] | null = null;
  private currentMode: DeviceModeType = DeviceModeSchema.Values.off;
  private lastDeviceRefreshTime = 0;
  private static readonly DEVICE_REFRESH_INTERVAL_MS = 60_000; // 1 minute
  public connectionStatus = ConnectionStatus.CONNECTING;

  private allParams = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      [DEVICE_PREFIX, this.deviceParams],
      [
        EFFECT_PREFIX,
        new DynamicParameterStorageView(() => this.currentEffect?.getEffectParameters() ?? emptyParameterStorageView),
      ],
    ])
  );

  private static readonly DEFAULT_MAX_FPS = 60;

  private readonly maxFps: RangeEffectParameter = this.deviceParams.register({
    id: 'fps',
    name: 'Max rendering frequency',
    description: 'Maximum frames per second for effect rendering',
    type: ParameterType.RANGE,
    value: DeviceHelper.DEFAULT_MAX_FPS,
    min: 1,
    max: 60,
    unit: 'fps',
  });
  private readonly gamma: RangeEffectParameter = this.deviceParams.register({
    id: 'gamma',
    name: 'Gamma correction',
    description: 'Gamma correction value for brightness adjustment',
    type: ParameterType.RANGE,
    value: 2.2, // Default gamma
    min: 0.1,
    max: 4.0,
    step: 0.1,
  });
  private readonly temperature: RangeEffectParameter = this.deviceParams.register({
    id: 'temperature',
    name: 'Color Temperature',
    description: 'Color temperature adjustment for effects, where -1 is cool/blue, 0 is neutral, and 1 is warm/orange',
    type: ParameterType.RANGE,
    value: 0, // No adjustment by default
    min: -1,
    max: 1,
    step: 0.1,
  });
  private readonly mirror: BooleanEffectParameter = this.deviceParams.register({
    id: 'mirror',
    name: 'Mirror LEDs',
    description: 'Reverse LED order for the entire device (e.g. for strips mounted in opposite orientation)',
    type: ParameterType.BOOLEAN,
    value: false,
  });
  private readonly gainRed: RangeEffectParameter = this.deviceParams.register({
    id: 'gainRed',
    name: 'Gain Red',
    description: 'Red channel gain adjustment',
    type: ParameterType.RANGE,
    value: 0,
    min: -100,
    max: 100,
    unit: '%',
    step: 1,
  });
  private readonly gainGreen: RangeEffectParameter = this.deviceParams.register({
    id: 'gainGreen',
    name: 'Gain Green',
    description: 'Green channel gain adjustment',
    type: ParameterType.RANGE,
    value: 0,
    min: -100,
    max: 100,
    unit: '%',
    step: 1,
  });
  private readonly gainBlue: RangeEffectParameter = this.deviceParams.register({
    id: 'gainBlue',
    name: 'Gain Blue',
    description: 'Blue channel gain adjustment',
    type: ParameterType.RANGE,
    value: 0,
    min: -100,
    max: 100,
    unit: '%',
    step: 1,
  });
  private readonly brightness: RangeEffectParameter = this.deviceParams.register(
    {
      id: 'brightness',
      name: 'Brightness',
      description: 'Current brightness of LEDs regardless of mode, not shown in previews',
      type: ParameterType.RANGE,
      value: 100,
      min: 0,
      max: 100,
      unit: '%',
      step: 1,
      transient: true,
    },
    async (_parameter, _oldValue, newValue) => {
      await this.apiClient.setBrightnessAbsolute(newValue);
    }
  );
  private readonly saturation: RangeEffectParameter = this.deviceParams.register(
    {
      id: 'saturation',
      name: 'Saturation',
      description: 'Current saturation of LEDs regardless of mode, not shown in previews',
      type: ParameterType.RANGE,
      value: 100,
      min: 0,
      max: 100,
      unit: '%',
      step: 1,
      transient: true,
    },
    async (_parameter, _oldValue, newValue) => {
      await this.apiClient.setSaturationAbsolute(newValue);
    }
  );
  private readonly autoRotate: BooleanEffectParameter = this.deviceParams.register(
    {
      id: 'autoRotate',
      name: 'Auto-rotate effects',
      description: 'Automatically cycle through all effects on a timer',
      type: ParameterType.BOOLEAN,
      value: false,
    },
    () => {
      this.onAutoRotateChanged?.(this.autoRotate.value, this.autoRotateInterval.value);
    }
  );
  private readonly autoRotateInterval: RangeEffectParameter = this.deviceParams.register(
    {
      id: 'autoRotateInterval',
      name: 'Auto-rotate interval',
      description: 'Seconds between automatic effect switches',
      type: ParameterType.RANGE,
      value: 30,
      min: 5,
      max: 600,
      step: 5,
      unit: 's',
    },
    () => {
      if (this.autoRotate.value) {
        this.onAutoRotateChanged?.(true, this.autoRotateInterval.value);
      }
    }
  );

  private onAutoRotateChanged?: (enabled: boolean, intervalSeconds: number) => void;

  public constructor(
    public readonly id: string,
    public readonly apiClient: TwinklyApiClient,
    public alias: string
  ) {}

  public isOnline(): boolean {
    return this.connectionStatus === ConnectionStatus.ONLINE;
  }

  public setAutoRotateCallback(callback: (enabled: boolean, intervalSeconds: number) => void): void {
    this.onAutoRotateChanged = callback;
  }

  public isAutoRotateEnabled(): boolean {
    return this.autoRotate.value;
  }

  public getAutoRotateIntervalSeconds(): number {
    return this.autoRotateInterval.value;
  }

  /** Expose device parameters as an EffectParameterView for callers to read/filter. */
  public getDeviceParams(): EffectParameterView {
    return this.deviceParams;
  }

  public async refreshFromDevice(): Promise<void> {
    await this.ensureConnected();
    await this.loadStateFromDevice();
  }

  /**
   * Load latest state from device and update local state.
   * Called periodically to stay in sync with external changes.
   */
  private async loadStateFromDevice(): Promise<void> {
    const summary = await this.apiClient.getSummary();
    this.currentMode = summary.led_mode.mode;
    const brightness = summary.filters?.find(
      (f) => f.filter === 'brightness' && f.config.mode === EnabledDisabledSchema.Values.enabled
    )?.config?.value;
    if (brightness !== undefined) {
      this.brightness.value = brightness;
    }
    this.lastDeviceRefreshTime = Date.now();
  }

  /**
   * Refresh state from device if enough time has passed since last refresh.
   * Returns true if a refresh was performed.
   */
  public async refreshStateFromDeviceIfStale(): Promise<boolean> {
    await this.ensureConnected();
    if (Date.now() - this.lastDeviceRefreshTime >= DeviceHelper.DEVICE_REFRESH_INTERVAL_MS) {
      await this.loadStateFromDevice();
      return true;
    }
    return false;
  }

  public getMode(): DeviceModeType {
    return this.currentMode;
  }

  public async setMode(mode: DeviceModeType): Promise<void> {
    await this.apiClient.setMode(mode);
    this.currentMode = mode;
  }

  public getBrightness(): number {
    return this.brightness.value;
  }

  private connectPromise: Promise<void> | null = null;

  private async ensureConnected(): Promise<void> {
    if (this.deviceConnected) {
      return;
    }
    if (!this.connectPromise) {
      this.connectPromise = this.connectToDevice();
    }
    await this.connectPromise;
  }

  private async connectToDevice(): Promise<void> {
    this.brightness.value = (await this.getFilterValue('brightness')) ?? 100;
    this.saturation.value = (await this.getFilterValue('saturation')) ?? 100;

    // Only use device frame rate as initial default; keep persisted value if restored
    if (this.maxFps.value === DeviceHelper.DEFAULT_MAX_FPS) {
      this.maxFps.value = (await this.getGestalt()).frame_rate;
    }

    // Initialize mode from device
    const summary = await this.apiClient.getSummary();
    this.currentMode = summary.led_mode.mode;
    this.lastDeviceRefreshTime = Date.now();

    this.deviceConnected = true;
  }

  public async getParameters(): Promise<EffectParameterView> {
    await this.ensureConnected();
    return this.allParams;
  }

  public async getFilterValue(name: string): Promise<number | undefined> {
    return (await this.apiClient.getSummary()).filters?.find(
      (filter) => filter.filter == name && filter.config.mode === EnabledDisabledSchema.Values.enabled
    )?.config?.value;
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

  public async getLedCount(): Promise<number> {
    return (await this.getGestalt()).number_of_led;
  }

  public async getDeviceName(): Promise<string> {
    const gestalt = await this.getGestalt();
    return gestalt.device_name || 'Unknown Device';
  }

  public async getPoints(effect: AnyEffect): Promise<LedPoint1D[] | LedPoint2D[]> {
    const ledCount = await this.getLedCount();
    if (effect.pointType === '1D') {
      if (!this.currentEffect) {
        throw new Error('No current effect set');
      }
      return this.getPoints1D(ledCount);
    }
    if (effect.pointType === '2D') {
      return this.getPoints2D(ledCount);
    }
    throw new Error(`Unsupported effect point type: ${effect.pointType}`);
  }

  private async getPoints1D(count: number): Promise<LedPoint1D[]> {
    if (this.points1DCache) {
      return this.points1DCache;
    }
    this.points1DCache = await this.currentEffect!.computePoints1D(count, () => this.getPoints2D(count));
    return this.points1DCache;
  }

  private invalidatePoints1DCache() {
    this.points1DCache = null;
  }

  private async getPoints2D(count: number): Promise<LedPoint2D[]> {
    return (await this.getLedMapping()).coordinates;
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

  public floatTo8bitColor(colors: RgbFloat[], effectGamma: number = 1.0, invertColors: boolean = false): Rgb24[] {
    const gamma = this.gamma.value * effectGamma;
    const temperature = this.temperature.value;
    const redGain = this.gainRed.value;
    const greenGain = this.gainGreen.value;
    const blueGain = this.gainBlue.value;
    const result: Rgb24[] = new Array(colors.length);
    for (let i = 0; i < colors.length; i++) {
      let color = colors[i];
      if (invertColors) {
        color = { red: 1 - color.red, green: 1 - color.green, blue: 1 - color.blue };
      }
      color = applyChannelGain(color, redGain, greenGain, blueGain);
      result[i] = floatTo8bit(adjustColorTemperatureNormalized(gammaCorrect(color, gamma), temperature));
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
        const shouldReverse = this.mirror.value !== (this.currentEffect?.getMirror() ?? false);
        return shouldReverse ? reverseMapper.mapLedIndex(index) : mapper.mapLedIndex(index);
      },
    };
  }

  private readonly onMappingModeChange = () => this.invalidatePoints1DCache();

  getCurrentEffect(): EffectWrapper | null {
    return this.currentEffect;
  }

  setCurrentEffect(effect: EffectWrapper | null) {
    this.currentEffect?.removeMappingModeChangeListener(this.onMappingModeChange);
    this.currentEffect = effect;
    this.invalidatePoints1DCache();
    effect?.addMappingModeChangeListener(this.onMappingModeChange);
  }

  public async getDebugInfo(): Promise<{ title: string; content: any }[]> {
    return [
      {
        title: 'Local',
        content: {
          connectionStatus: this.connectionStatus,
          currentMode: this.currentMode,
          currentEffect: this.currentEffect?.id ?? null,
        },
      },
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
      },
    ];
  }
}
