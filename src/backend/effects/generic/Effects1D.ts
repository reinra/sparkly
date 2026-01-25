import { BLACK, WHITE, type RgbValue } from "../../color/Color";
import { hslToRgb } from "../../color/Hsl";
import { PerPixelEffect, type Effect, type EffectContext, type LedPoint1D } from "./Effect";

export class TestPerLedEffect1D implements Effect<LedPoint1D> {
  pointType: "1D" = "1D";
  isStateful: boolean = false;
  getName(): string {
      return "Test Per-Led Effect 1D";
  }
  getLoopDurationSeconds(ledCount: number): number {
      return ledCount / 2;
  }
  update(ctx: EffectContext, deltaTimeMs: number): void {
    // ignore
  }
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbValue[] {
    const result: RgbValue[] = new Array(points.length).fill(BLACK);
    const index = Math.floor(ctx.phase * points.length);
    result[index] = WHITE;
    return result;
  }
}

export class RainbowGradientEffect1D extends PerPixelEffect<LedPoint1D> {
  pointType: "1D" = "1D";
  getName(): string {
      return "Rainbow Gradient Effect 1D";
  }
  getLoopDurationSeconds(ledCount: number): number {
      return 10;
  }
  renderPixel(ctx: EffectContext, point: LedPoint1D): RgbValue {
    // We use the normalized 'distance' for a smooth gradient
    const hue = (ctx.phase + point.distance) % 1.0;
    return hslToRgb({hue, saturation: 1, lightness: 0.5});
  }
}
