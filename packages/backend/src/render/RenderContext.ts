import type { RgbFloat } from '../color/ColorFloat';
import type { LedType, RgbValue } from '../color/Color8bit';
import type { LedPoint1D, LedPoint2D, AnyEffect } from '../effects/Effect';
import type { LedMapper } from './LedMapper';
import type { DeviceHelper } from '../DeviceHelper';
import { EffectWrapper } from '../EffectWrapper';

// ── Interface ─────────────────────────────────────────────────────────

/**
 * Rendering-level abstraction that bundles everything the renderer and
 * effect launcher need without knowing *where* a value is stored
 * (per-device, per-effect, or per-device+effect combination).
 */
export interface RenderContext {
  /** The effect to render. */
  readonly effect: AnyEffect;

  /** Number of LEDs on the device. */
  getNumberOfLeds(): Promise<number>;

  /** LED profile type (rgb, rgbw, …). */
  getLedProfile(): Promise<LedType>;

  /** LED points appropriate for the current effect type and mapping mode. */
  getPoints(): Promise<LedPoint1D[] | LedPoint2D[]>;

  /** Convert float colours to 8-bit applying gamma / temperature corrections. */
  floatTo8bitColor(colors: RgbFloat[]): RgbValue[];

  /** Minimum time between frames in milliseconds (derived from max FPS). */
  getMinFrameTimeMs(): number;

  /** Current speed multiplier for the effect. */
  getCurrentSpeedMultiplier(): number;

  /** Get LED mapper that compensates for physical wiring order. */
  getLedMapper(fixStringsIfNeeded: boolean): Promise<LedMapper>;
}

// ── Implementation ────────────────────────────────────────────────────

/**
 * Concrete implementation that delegates every call to
 * {@link DeviceHelper} and {@link EffectWrapper}.
 *
 * Created by the service layer so that downstream rendering code never
 * needs to know about the two backing objects.
 */
export class RenderContextImpl implements RenderContext {
  constructor(
    private readonly deviceHelper: DeviceHelper,
    private readonly effectWrapper: EffectWrapper
  ) {}

  get effect(): AnyEffect {
    return this.effectWrapper.effect;
  }

  async getNumberOfLeds(): Promise<number> {
    return (await this.deviceHelper.getGestalt()).number_of_led;
  }

  async getLedProfile(): Promise<LedType> {
    return (await this.deviceHelper.getGestalt()).led_profile;
  }

  async getPoints(): Promise<LedPoint1D[] | LedPoint2D[]> {
    const points = await this.deviceHelper.getPoints(this.effectWrapper.effect);
    if (this.effectWrapper.effect.pointType === '2D') {
      return EffectWrapper.rotatePoints2D(points as LedPoint2D[], this.effectWrapper.getRotation());
    }
    return points;
  }

  floatTo8bitColor(colors: RgbFloat[]): RgbValue[] {
    return this.deviceHelper.floatTo8bitColor(
      colors,
      this.effectWrapper.getGamma(),
      this.effectWrapper.getInvertColors()
    );
  }

  getMinFrameTimeMs(): number {
    return this.deviceHelper.getMinFrameTimeMs();
  }

  getCurrentSpeedMultiplier(): number {
    return this.effectWrapper.getCurrentSpeedMultiplier();
  }

  async getLedMapper(fixStringsIfNeeded: boolean): Promise<LedMapper> {
    return this.deviceHelper.getLedMapper(fixStringsIfNeeded);
  }
}
