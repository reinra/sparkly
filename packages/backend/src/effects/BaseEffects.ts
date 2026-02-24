import { RgbFloat } from '../color/ColorFloat';
import { EffectParameterView } from '../effectParameters';
import {
  AnimationMode,
  type Effect,
  type EffectContextGeneric,
  type EffectLogic,
  type LedPoint,
  type LedPoint1D,
  type LedPointType,
} from './Effect';

export interface StatelessEffect<A extends AnimationMode, P extends LedPoint> extends Effect<A, P>, EffectLogic<A, P> {
  readonly isStateful: false;
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

export abstract class BaseSameColorEffect<A extends AnimationMode>
  extends BaseSameColorEffectLogic<A>
  implements Effect<A, LedPoint1D>
{
  abstract readonly animationMode: A;
  pointType: '1D' = '1D';
  isStateful: boolean = false;
  parameters?: EffectParameterView;
  abstract getName(): string;
  createLogic() {
    return this;
  }
}

export abstract class PerPixelEffect<A extends AnimationMode, P extends LedPoint>
  extends PerPixelEffectLogic<A, P>
  implements Effect<A, P>
{
  abstract readonly animationMode: A;
  abstract readonly pointType: LedPointType;
  isStateful: boolean = false;
  parameters?: EffectParameterView;
  abstract getName(): string;
  createLogic() {
    return this;
  }
}
