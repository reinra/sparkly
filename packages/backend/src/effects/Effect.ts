import type { LedType, RgbValue } from '../color/Color8bit';
import { RgbFloat } from '../color/ColorFloat';
import { EffectParameterView, ParameterValue } from '../effectParameters';

export enum AnimationMode {
  // Single frame.
  // Phase or time is not provided as input.
  Static = 'static',
  // The effect loops continuously, with the phase parameter going from 0 to 1 over the course of each loop
  // The effect itself defines the duration of each loop via getLoopDurationSeconds()
  Loop = 'loop',
  // The effect progresses based on time, with the time_ms parameter increasing indefinitely.
  // Phase is not provided as input.
  // The effect can seamlessly loop but the longer it runs the nicer it looks.
  // The effect may receive the duration of a full loop by the user/renderer. Memory contraints may limit the length.
  Sequence = 'sequence',
}

export type EffectContextGeneric<T extends AnimationMode> = T extends AnimationMode.Static
  ? EffectContextStatic
  : T extends AnimationMode.Loop
  ? EffectContextLoop
  : T extends AnimationMode.Sequence
  ? EffectContextSequence
  : never;

export interface EffectContextBase {
  // 1. CHANGING LESS
  // Integer, total number of LEDs in the buffer
  readonly total_leds: number;
  // LedType of the LED buffer
  readonly led_type: LedType;
}

export interface EffectContextStatic extends EffectContextBase {}

export interface EffectContextLoop extends EffectContextBase {
  // 2. CONSTANTLY CHANGING
  // Float [0.0, 1.0) representing the progress through the effect in a loop
  readonly phase: number;
}

export interface EffectContextSequence extends EffectContextBase {
  // 1. CHANGING LESS
  // Integer, total duration of the effect sequence in milliseconds, provided by the user/renderer.
  // The effect can use this information to seamlessly loop.
  // If null, the effect run indefinitely.
  readonly total_time_ms: number | null;

  // 2. CONSTANTLY CHANGING
  // Integer, scaled time since the effect started in milliseconds
  readonly time_ms: number;
  // Integer, scaled time since the last renderGlobal() call in milliseconds
  readonly delta_time_ms: number;
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

export type EffectUnion<P extends LedPoint> = EffectStatic<P> | EffectLoop<P> | EffectSequence<P>;

/** Any effect regardless of animation mode or point type. */
export type AnyEffect = Effect<AnimationMode, LedPoint>;

export interface Effect<A extends AnimationMode, P extends LedPoint> {
  readonly animationMode: A;
  // Runtime type identifier for the generic parameter
  readonly pointType: LedPointType;
  // If true, the effect maintains internal state across frames (and should also not be reused concurrently between devices)
  readonly isStateful: boolean;

  // Allow to change certain parameters of the effect at runtime (e.g. colors, etc.)
  readonly parameters?: EffectParameterView;

  getName(): string;
  getPresets?(): EffectPreset[];

  // Factory function to create a new instance of the effect logic, for stateless effects this can just return 'this'
  createLogic: () => EffectLogic<A, P>;
}

export interface EffectStatic<P extends LedPoint> extends Effect<AnimationMode.Static, P> {
  readonly animationMode: AnimationMode.Static;
}

export interface EffectLoop<P extends LedPoint> extends Effect<AnimationMode.Loop, P> {
  readonly animationMode: AnimationMode.Loop;
  getLoopDurationSeconds(ledCount: number): number;
}

export interface EffectSequence<P extends LedPoint> extends Effect<AnimationMode.Sequence, P> {
  readonly animationMode: AnimationMode.Sequence;
  // If the effect can seamlessly loop, it can use the total_time_ms parameter from the EffectContextSequence to loop seamlessly.
  // If false, the effect may look choppy when recorded and repeated. An external (not from effect) helping transition may be needed in this case to make the loop less jarring.
  supportsSeamlessLooping: boolean;
}

export interface EffectLogic<A extends AnimationMode, P extends LedPoint> {
  // Renders the full LED buffer for the current effect state
  renderGlobal(ctx: EffectContextGeneric<A>, points: P[]): RgbFloat[];
}

export interface StatelessEffect<A extends AnimationMode, P extends LedPoint> extends Effect<A, P>, EffectLogic<A, P> {
  readonly isStateful: false;
}

export function is1DEffect<A extends AnimationMode>(effect: Effect<A,LedPoint>): effect is Effect<A,LedPoint1D> {
  return effect.pointType === '1D';
}
export function is2DEffect<A extends AnimationMode>(effect: Effect<A,LedPoint>): effect is Effect<A,LedPoint2D> {
  return effect.pointType === '2D';
}

export abstract class PerPixelEffectLogic<A extends AnimationMode, P extends LedPoint> implements EffectLogic<A, P> {
  renderGlobal(ctx: EffectContextGeneric<A>, points: P[]): RgbFloat[] {
    const result: RgbFloat[] = new Array(points.length);
    for (const point of points) {
      result[point.id] = this.renderPixel(ctx, point);
    }
    return result;
  }
  abstract renderPixel(ctx: EffectContextGeneric<A>, point: P): RgbFloat;
}

export abstract class BaseSameColorEffectLogic<A extends AnimationMode> implements EffectLogic<A, LedPoint1D> {
  renderGlobal(ctx: EffectContextGeneric<A>, points: LedPoint1D[]): RgbFloat[] {
    const color = this.renderColor(ctx);
    return new Array(points.length).fill(color);
  }
  abstract renderColor(ctx: EffectContextGeneric<A>): RgbFloat;
}

export abstract class BaseSameColorEffect<A extends AnimationMode> extends BaseSameColorEffectLogic<A> implements Effect<A, LedPoint1D> {
  abstract readonly animationMode: A;
  pointType: '1D' = '1D'
  isStateful: boolean = false;
  parameters?: EffectParameterView;
  abstract getName(): string;
  createLogic() {
    return this;
  }  
}

export abstract class PerPixelEffect<A extends AnimationMode, P extends LedPoint> extends PerPixelEffectLogic<A, P> implements Effect<A, P> {
  abstract readonly animationMode: A;
  abstract readonly pointType: LedPointType;
  isStateful: boolean = false;
  parameters?: EffectParameterView;
  abstract getName(): string;
  createLogic() {
    return this;
  }
}

export interface EffectPreset {
  readonly id: string;
  readonly name: string;
  readonly config: Map<string, ParameterValue>;
}
 