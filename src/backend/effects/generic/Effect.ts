import type { LedType, RgbValue } from "../../render/Color";

export interface EffectContext {
    // Float [0.0, 1.0) representing the progress through the effect in a loop
    readonly phase: number;
    // Integer, time since the effect started in milliseconds
    readonly time_ms: number;
    // Integer, current frame index since the effect started
    readonly frame_index: number;
    // Float, speed multiplier for the effect
    readonly speed: number;
    // Integer, total number of LEDs in the buffer
    readonly total_leds: number;
    // LedType of the LED buffer
    readonly led_type: LedType;
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
    readonly pointType: P extends LedPoint1D ? '1D' : P extends LedPoint2D ? '2D' : LedPointType;
    // If true, the effect maintains internal state across frames, runner will call update()
    readonly isStateful: boolean;
    getName(): string;
    // Returns the duration of a full effect loop in seconds
    getLoopDurationSeconds(ledCount: number): number;
    // For simulation-based effects, update internal state based on time progression
    update(ctx: EffectContext, deltaTimeMs: number): void;
    // Renders the full LED buffer for the current effect state
    renderGlobal(ctx: EffectContext, points: P[]): RgbValue[];
}

export abstract class PerPixelEffect<P extends LedPoint> implements Effect<P> {
    abstract readonly pointType: P extends LedPoint1D ? '1D' : P extends LedPoint2D ? '2D' : LedPointType;
    isStateful: boolean = false;
    update(ctx: EffectContext, deltaTimeMs: number): void {
        throw new Error("Method not implemented.");
    }
    abstract getName(): string;
    abstract getLoopDurationSeconds(ledCount: number): number;
    abstract renderPixel(ctx: EffectContext, point: P): RgbValue;
    renderGlobal(ctx: EffectContext, points: P[]): RgbValue[] {
        const result: RgbValue[] = new Array(points.length);
        for (const point of points) {
            result[point.id] = this.renderPixel(ctx, point);
        }
        return result;
    }
}
