export enum Direction {
  In = 'in',
  Out = 'out',
  InOut = 'in_out',
}

export interface Easing {
  readonly direction: Direction;
  /**
   * Easing function that takes a value from 0 to 1 and returns a value from 0 to 1.
   * Regardless the direction, we expect f(0)=0 and f(1)=1.
   */
  easingFunction: (t: number) => number;
}
export type EasingIn = Easing & { direction: Direction.In };
export type EasingOut = Easing & { direction: Direction.Out };
export type EasingInOut = Easing & { direction: Direction.InOut };

export function reverseEasing(easing: EasingIn): EasingOut {
  return {
    easingFunction: (t: number) => 1 - easing.easingFunction(1 - t),
    direction: Direction.Out,
  };
}

export function inOutEasing(easing: EasingIn): EasingInOut {
  return {
    direction: Direction.InOut,
    easingFunction: (t: number) => {
      if (t < 0.5) {
        return easing.easingFunction(t * 2) / 2;
      } else {
        return 1 - easing.easingFunction((1 - t) * 2) / 2;
      }
    },
  };
}

export const LinearIn: EasingIn = {
  direction: Direction.In,
  easingFunction: (t: number) => t,
};

export const NoopIn: EasingIn = {
  direction: Direction.In,
  easingFunction: (t: number) => 1,
};

export const CubicIn: EasingIn = {
  direction: Direction.In,
  easingFunction: (t: number) => t * t * t,
};

export const CubicOut = reverseEasing(CubicIn);
export const NoopOut = reverseEasing(NoopIn);
export const LinearOut = reverseEasing(LinearIn);

export const CubicInOut = inOutEasing(CubicIn);
export const NoopInOut = inOutEasing(NoopIn);
export const LinearInOut = inOutEasing(LinearIn);

/** Base easing function type: f(0)=0, f(1)=1, except Noop which always returns 1. */
export type EasingFunction = (t: number) => number;

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
