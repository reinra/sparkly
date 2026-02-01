import { RgbValue } from "../../color/Color";
import { hslToRgb } from "../../color/Hsl";
import { PerPixelEffect, LedPoint2D, EffectContext, LedPoint1D, Effect } from "./Effect";

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
        return hslToRgb({ hue, saturation: point.y, lightness: 0.5 });
    }
}

export class AdapterFrom1DEffectTo2D implements Effect<LedPoint2D> {
    pointType: "2D" = "2D";
    constructor(private effect1D: Effect<LedPoint1D>) { }
    isStateful: boolean = this.effect1D.isStateful;
    getName(): string {
        return `Adapter(2D<-1D): ${this.effect1D.getName()}`;
    }
    getLoopDurationSeconds(ledCount: number): number {
        return this.effect1D.getLoopDurationSeconds(ledCount);
    }
    renderGlobal(ctx: EffectContext, points: LedPoint2D[]): RgbValue[] {
        // Map the 2D points to 1D points by using only the X coordinate
        const points1D: LedPoint1D[] = points.map(point => ({
            id: point.id,
            position: point.id,
            distance: point.y,
        }));
        return this.effect1D.renderGlobal(ctx, points1D);
    }
}
