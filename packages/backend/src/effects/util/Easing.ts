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
