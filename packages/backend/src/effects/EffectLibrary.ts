import { EffectWrapper } from '../EffectWrapper';
import { Effect, EffectPreset } from './Effect';
import {
  ChangeColorEffect,
  MeteorEffect,
  PingPongEffect,
  RainbowGradientEffect,
  SingleColorRainEffect,
  RotatingColorGradientEffect,
  SineEffect,
  SingleHslColorEffect,
  StaticColorGradientEffect,
  TestPerLedEffect,
  TwinkleEffect,
  TwoAlternatingCustomColorFadingEffect,
  MultiColorRainEffect,
  StaticCustomColorGradientEffect,
  TestAllLedsFlash,
  StaticAlternatingColorCustomEffect,
  FlipColorCustomEffect,
} from './Effects1D';
import {
  CloudsEffect,
  GravityFountain,
  PlasmaEffect,
  PulseScanner,
  RainbowGradientEffect2D,
  Slime,
} from './Effects2D';

const effects: Record<string, EffectWrapper> = {};

function addPresets<T extends Effect<any> & { getPresets(): EffectPreset[] }>(EffectClass: new () => T): void {
  const template = new EffectClass();
  const presets = template.getPresets();
  for (const preset of presets) {
    const effect = new EffectClass();
    const wrapper = new EffectWrapper(preset.id, effect, preset.name);      
    for (const [paramId, value] of preset.config.entries()) {
      wrapper.getEffectParameters().setValue(paramId, value);
    }
    effects[preset.id] = wrapper;      
  }
}

function add(id: string, effect: Effect<any>): void {
  effects[id] = new EffectWrapper(id, effect, effect.getName());
}
 
addPresets(FlipColorCustomEffect);
addPresets(ChangeColorEffect);
addPresets(SingleHslColorEffect);
addPresets(StaticAlternatingColorCustomEffect);
addPresets(StaticColorGradientEffect);
addPresets(RotatingColorGradientEffect);
add('gradient_custom', new StaticCustomColorGradientEffect());
add('two_alternating_colors_custom', new TwoAlternatingCustomColorFadingEffect());
add('rainbow', new RainbowGradientEffect());
add('meteor', new MeteorEffect());
add('rain_single_color', new SingleColorRainEffect());
add('rain_multi_color', new MultiColorRainEffect());
add('twinkle', new TwinkleEffect());
add('sine', new SineEffect());
add('ping_pong', new PingPongEffect());
add('rainbow_2d', new RainbowGradientEffect2D());
add('pulse_scanner', new PulseScanner());
add('slime', new Slime());
add('clouds', new CloudsEffect());
add('plasma', new PlasmaEffect());
add('gravity_fountain', new GravityFountain());
add('test_per_led', new TestPerLedEffect());
add('test_all_leds_flash', new TestAllLedsFlash());

export { effects };
