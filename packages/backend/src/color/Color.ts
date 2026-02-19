import { Hsl } from "../ParameterTypes";
import { RgbFloat } from "./ColorFloat";
import { hslToRgb, hslToRgbFloat, rgbFloatToHsl } from "./Hsl";

export interface Color {
    asRgb(): RgbFloat;
    asHsl(): Hsl;
}

export class HslColor implements Color {
    constructor(private hsl: Hsl) {}

    asRgb(): RgbFloat {
        return hslToRgbFloat(this.hsl);
    }

    asHsl(): Hsl {
        return this.hsl;
    }
}

export class RgbColor implements Color {
    constructor(private rgb: RgbFloat) {}

    asRgb(): RgbFloat {
        return this.rgb;
    }

    asHsl(): Hsl {
        return rgbFloatToHsl(this.rgb);
    }
}
