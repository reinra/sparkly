
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

export function reverseEasing(easing: EasingIn): EasingOut {
  return {
    easingFunction: (t: number) => 1 - easing.easingFunction(1 - t),
    direction: Direction.Out,
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
