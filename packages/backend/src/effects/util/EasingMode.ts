import { EffectParameterStorage } from "../../effectParameters";
import { OptionEffectParameter, ParameterType } from "../../ParameterTypes";
import { CubicIn, CubicOut, EasingIn, EasingOut, LinearIn, LinearOut, NoopIn, NoopOut } from "./Easing";

export enum EasingMode {
    Noop = 'noop',
    Linear = 'linear',
    Cubic = 'cubic',
}


export class EasingParameters {
    public readonly parameters = new EffectParameterStorage();
    private readonly type: OptionEffectParameter = this.parameters.register({
        id: 'type',
        name: 'Easing',
        description: 'Easing function to use for fade-in and fade-out',
        type: ParameterType.OPTION,
        value: EasingMode.Linear,
        options: [
            { value: EasingMode.Noop, label: 'Noop', description: 'No easing' },
            { value: EasingMode.Linear, label: 'Linear', description: 'Linear easing' },
            { value: EasingMode.Cubic, label: 'Cubic', description: 'Cubic easing' },
        ],
    }); 
    public getInEasingFunction(): EasingIn {
        const mode = this.type.value as EasingMode;
        switch (mode) {
            case EasingMode.Noop:
                return NoopIn;
            case EasingMode.Linear:
                return LinearIn;
            case EasingMode.Cubic:
                return CubicIn;
        }
    }
    public getOutEasingFunction(): EasingOut {
        const mode = this.type.value as EasingMode;
        switch (mode) {
            case EasingMode.Noop:
                return NoopOut;
            case EasingMode.Linear:
                return LinearOut;
            case EasingMode.Cubic:
                return CubicOut;
        }
    }
}
