import type { LedType, RgbValue } from '../../color/Color8bit';
import { RgbFloat } from '../../color/ColorFloat';
import { EffectParameterView } from '../../effectParameters';

export interface EffectContext {
  // 1. CHANGING LESS

  // Integer, total number of LEDs in the buffer
  readonly total_leds: number;
  // LedType of the LED buffer
  readonly led_type: LedType;

  // 2. CONSTANTLY CHANGING

  // Float [0.0, 1.0) representing the progress through the effect in a loop
  readonly phase: number;
  // Integer, scaled time since the effect started in milliseconds
  readonly time_ms: number;
  // Integer, scaled time since the last renderGlobal() call in milliseconds
  readonly delta_time_ms: number;
  // Integer, current frame index since the effect started
  readonly frame_index: number;
}

export interface LedPoint1D {
  // Integer, index in the hardware buffer
  readonly id: number;
  // Integer, position along the 1D strip
  readonly position: number;
  // Float, distance from the start of the strip normalized to [0.0, 1.0]
  readonly distance: number;
}

export interface LedPoint2D {
  // Integer, index in the hardware buffer
  readonly id: number;
  // Float, X coordinate of the LED normalized to [0.0, 1.0]
  readonly x: number;
  // Float, Y coordinate of the LED normalized to [0.0, 1.0]
  readonly y: number;
}

export type LedPoint = LedPoint1D | LedPoint2D;

export type LedPointType = '1D' | '2D';

export interface Effect<P extends LedPoint> {
  // Runtime type identifier for the generic parameter
  readonly pointType: LedPointType;
  // If true, the effect maintains internal state across frames (and should also not be reused concurrently between devices)
  readonly isStateful: boolean;
  // Allow to change certain parameters of the effect at runtime (e.g. colors, etc.)
  readonly parameters?: EffectParameterView;
  getName(): string;
  // Returns the duration of a full effect loop in seconds, 0 means the effect is static.
  getLoopDurationSeconds(ledCount: number): number;
  // Renders the full LED buffer for the current effect state
  renderGlobal(ctx: EffectContext, points: P[]): RgbFloat[];
}

export abstract class PerPixelEffect<P extends LedPoint> implements Effect<P> {
  abstract readonly pointType: LedPointType;
  isStateful: boolean = false;
  abstract getName(): string;
  abstract getLoopDurationSeconds(ledCount: number): number;
  renderGlobal(ctx: EffectContext, points: P[]): RgbFloat[] {
    const result: RgbFloat[] = new Array(points.length);
    for (const point of points) {
      result[point.id] = this.renderPixel(ctx, point);
    }
    return result;
  }
  abstract renderPixel(ctx: EffectContext, point: P): RgbFloat;
}

export abstract class BaseSameColorEffect implements Effect<LedPoint1D> {
  readonly pointType: LedPointType = '1D';
  isStateful: boolean = false;
  abstract getName(): string;
  abstract getLoopDurationSeconds(ledCount: number): number;
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbFloat[] {
    const color = this.renderColor(ctx);
    return new Array(points.length).fill(color);
  }
  abstract renderColor(ctx: EffectContext): RgbFloat;
}

export function is1DEffect(effect: Effect<LedPoint>): effect is Effect<LedPoint1D> {
  return effect.pointType === '1D';
}
export function is2DEffect(effect: Effect<LedPoint>): effect is Effect<LedPoint2D> {
  return effect.pointType === '2D';
}
