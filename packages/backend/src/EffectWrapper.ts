import { EffectParameterStorage, EffectParameterView, emptyParameterStorageView, MultiParameterStorageView } from "./effectParameters";
import { Effect } from "./effects/Effect";
import { ParameterType, RangeEffectParameter } from "./ParameterTypes";

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
    constructor(public readonly effect: Effect<any>) { }
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
