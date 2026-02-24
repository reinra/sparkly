export enum Direction {
  In = 'in',
  Out = 'out',
  InOut = 'in_out',
}

/** Base easing function type: f(0)=0, f(1)=1, except Noop which always returns 1. */
export type EasingFunction = (t: number) => number;

/** No easing — always returns 1. */
export const noopEasing: EasingFunction = (_t: number) => 1;

/** Linear easing — identity function. */
export const linearEasing: EasingFunction = (t: number) => t;

/** Cubic easing — ease in curve. */
export const cubicEasing: EasingFunction = (t: number) => t * t * t;

/** Quadratic easing — gentle acceleration. */
export const quadraticEasing: EasingFunction = (t: number) => t * t;

/** Quartic easing — strong acceleration. */
export const quarticEasing: EasingFunction = (t: number) => t * t * t * t;

/** Sine easing — very smooth, natural feel. */
export const sineEasing: EasingFunction = (t: number) => 1 - Math.cos((t * Math.PI) / 2);

/** Exponential easing — dramatic, starts very slow then snaps. */
export const exponentialEasing: EasingFunction = (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));

/** Circular easing — based on circle arc, smooth start. */
export const circularEasing: EasingFunction = (t: number) => 1 - Math.sqrt(1 - t * t);

/**
 * Wraps a base easing function with a direction transformation.
 * - In:    f(t)               — 0 → 1
 * - Out:   f(1 - t)           — 1 → 0
 * - InOut: f(1 - |2t - 1|)   — 0 → 1 → 0
 */
export function wrapWithDirection(fn: EasingFunction, direction: Direction): EasingFunction {
  switch (direction) {
    case Direction.In:
      return fn;
    case Direction.Out:
      return (t: number) => fn(1 - t);
    case Direction.InOut:
      return (t: number) => fn(1 - Math.abs(2 * t - 1));
  }
}
