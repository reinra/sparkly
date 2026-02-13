import { EffectParameterStorage, EffectParameterView, emptyParameterStorageView, MultiParameterStorageView } from "./effectParameters";
import { BaseSameColorEffect, Effect, LedPoint1D, LedPoint2D } from "./effects/Effect";
import { OptionEffectParameter, ParameterType, RangeEffectParameter } from "./ParameterTypes";

export const enum MappingMode {
    UseXAsPosition = "UseXAsPosition",
    UseYAsPosition = "UseYAsPosition",
    UseDistanceAsPosition = "UseDistanceAsPosition"
}

export class EffectWrapper {
    private readonly parameters = new EffectParameterStorage();
    private readonly speed: RangeEffectParameter = this.parameters.register({
        id: 'speed',
        name: 'Speed',
        description: 'Global speed multiplier for effects',
        type: ParameterType.RANGE,
        value: 1.0,
        min: 0.0,
        max: 5.0,
        unit: 'x',
        step: 0.1,
    });
    private readonly mappingMode: OptionEffectParameter = this.parameters.register({
        id: 'mode',
        name: 'Mapping Mode',
        description: 'Mode for mapping 1D effect to 2D',
        type: ParameterType.OPTION,
        value: MappingMode.UseDistanceAsPosition,
        options: [
            { value: MappingMode.UseDistanceAsPosition, label: 'Sequence', description: 'Map the distance from center (0-1) to the 1D effect position' },
            { value: MappingMode.UseXAsPosition, label: 'Horizontal', description: 'Map the X coordinate (0-1) to the 1D effect position' },
            { value: MappingMode.UseYAsPosition, label: 'Vertical', description: 'Map the Y coordinate (0-1) to the 1D effect position' },
        ],
    }, () => {
        this.points1DCache = null;
    });
    private points1DCache: LedPoint1D[] | null = null;

    constructor(public readonly effect: Effect<any>) {
        this.mappingMode.hidden = effect.pointType === '2D' || effect instanceof BaseSameColorEffect;
    }

    public async getPoints1D(count: number, getPoints2D: () => Promise<LedPoint2D[]>): Promise<LedPoint1D[]> {
        if (this.points1DCache) {
            return this.points1DCache;
        }
        this.points1DCache = await this.computePoints1D(count, getPoints2D);
        return this.points1DCache;
    }

    private async computePoints1D(count: number, getPoints2D: () => Promise<LedPoint2D[]>): Promise<LedPoint1D[]> {
        const mode = this.mappingMode.value as MappingMode;
        if (mode === MappingMode.UseDistanceAsPosition) {
            return EffectWrapper.getSimplePoints1D(count);
        }
        const points = await getPoints2D();
        return points.map((point) => ({
            id: point.id,
            position: point.id,
            distance: getDistance(mode, point, count),
        }));
    }

    private static getSimplePoints1D(count: number): LedPoint1D[] {
        const points: LedPoint1D[] = [];
        for (let i = 0; i < count; i++) {
            points.push({ id: i, position: i, distance: i / count });
        }
        return points;
    }

    public getEffectParameters(): EffectParameterView {
        if (this.effect.parameters) {
            return new MultiParameterStorageView(
                new Map<string, EffectParameterView>([
                    ["wrapper", this.parameters],
                    ["custom", this.effect.parameters],
                ])
            );
        }
        return this.parameters;
    }
    public getCurrentSpeedMultiplier(): number {
        return this.speed.value;
    }
}

function getDistance(mode: MappingMode, point: LedPoint2D, count: number): number {
    switch (mode) {
        case MappingMode.UseXAsPosition:
            return point.x;
        case MappingMode.UseYAsPosition:
            return point.y;
        case MappingMode.UseDistanceAsPosition:
            return point.id / count;
    }
    throw new Error("Unreachable");
}
