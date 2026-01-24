import { BLACK, WHITE, type RgbValue } from "../../render/Color";
import type { Effect, EffectContext, LedPoint1D } from "./Effect";

export class TestPerLedEffect1D implements Effect<LedPoint1D> {
  pointType: "1D" = "1D";
  isStateful: boolean = false;
  getName(): string {
      return "Test Per-Led Effect 1D";
  }
  getLoopDurationSeconds(ledCount: number): number {
      return ledCount / 10;
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
