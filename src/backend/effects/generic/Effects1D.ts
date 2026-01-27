import { BLACK, lerp, WHITE, type RgbValue } from "../../color/Color";
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

export class MeteorEffect implements Effect<LedPoint1D> {
  pointType: "1D" = "1D";
  isStateful: boolean = true;
  private lastBuffer: RgbValue[] | null = null;
  getName(): string {
      return "Meteor";  
  }
  getLoopDurationSeconds(ledCount: number): number {
      return 5;
  }
  renderGlobal(ctx: EffectContext, points: LedPoint1D[]): RgbValue[] {
    // 1. Fade the whole buffer slightly (creates the trail)
    // The fade amount is scaled by deltaTime to keep it FPS-independent
    const fadeFactor = 1.0 - (ctx.delta_time_ms / 500); // Lose full brightness every 500ms

    if (this.lastBuffer === null || this.lastBuffer.length !== ctx.total_leds) {
      this.lastBuffer = new Array(ctx.total_leds).fill(BLACK);
    }
    else {
      for (let i = 0; i < this.lastBuffer.length; i++) {
        this.lastBuffer[i] = lerp(BLACK, this.lastBuffer[i], fadeFactor);
      }
    }

    // 2. Draw the "Head" of the meteor
    const headIndex = Math.floor(ctx.phase * ctx.total_leds);
    if (headIndex < this.lastBuffer.length) {
      this.lastBuffer[headIndex] = WHITE; // Bright white head
    }  
    return this.lastBuffer;
  }
}
