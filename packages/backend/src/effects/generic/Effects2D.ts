import { RgbValue } from "../../color/Color";
import { hslToRgb } from "../../color/Hsl";
import { PerPixelEffect, LedPoint2D, EffectContext, LedPoint1D } from "./Effect";

export class RainbowGradientEffect2D extends PerPixelEffect<LedPoint2D> {
  pointType: "2D" = "2D";
  getName(): string {
      return "Rainbow Gradient 2D";
  }
  getLoopDurationSeconds(ledCount: number): number {
      return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint2D): RgbValue {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.x) % 1.0;
    return hslToRgb({hue, saturation: point.y, lightness: 0.5});
  }
}
