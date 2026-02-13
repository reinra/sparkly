import { BLACK, BLUE, GREEN, RED, RgbFloat, WHITE, YELLOW } from '../color/ColorFloat';
import { EffectWrapper } from '../EffectWrapper';
import { Effect } from './Effect';
import {
  ChangeColorEffect,
  FlipColorEffect,
  MeteorEffect,
  PingPongEffect,
  RainbowGradientEffect1D,
  SingleColorRainEffect,
  RotatingColorGradientEffect,
  SineEffect,
  SingleColorEffect,
  SingleHslColorEffect,
  StaticAlternatingColorEffect,
  StaticColorGradientEffect,
  TestPerLedEffect,
  TwinkleEffect,
  TwoAlternatingColorFadingEffect,
  TwoAlternatingCustomColorFadingEffect,
  MultiColorRainEffect,
  StaticCustomColorGradientEffect,
  TestAllLedsFlash,
} from './Effects1D';
import {
  CloudsEffect,
  GravityFountain,
  PlasmaEffect,
  PulseScanner,
  RainbowGradientEffect2D,
  Slime,
} from './Effects2D';

const redGreenBlue: RgbFloat[] = [RED, GREEN, BLUE];

const effects: Record<string, EffectWrapper> = {};

function add(id: string, effect: Effect<any>): void {
  effects[id] = new EffectWrapper(effect);
}

add('flip_color', new FlipColorEffect(redGreenBlue));
add('change_color', new ChangeColorEffect(redGreenBlue));
add('red', new SingleColorEffect(RED));
add('green', new SingleColorEffect(GREEN));
add('blue', new SingleColorEffect(BLUE));
add('black', new SingleColorEffect(BLACK));
add('white', new SingleColorEffect(WHITE));
add('choose_hsl', new SingleHslColorEffect());
add('alternate_rgb', new StaticAlternatingColorEffect([RED, GREEN, BLUE]));
add('alternate_rgby', new StaticAlternatingColorEffect([RED, GREEN, BLUE, YELLOW]));
add('gradient_red_yellow', new StaticColorGradientEffect([RED, YELLOW]));
add('gradient_rgb', new StaticColorGradientEffect([RED, GREEN, BLUE]));
add('gradient_rgbr', new StaticColorGradientEffect([RED, GREEN, BLUE, RED]));
add('rotating_gradient_rgbr', new RotatingColorGradientEffect([RED, GREEN, BLUE, RED]));
add('gradient_black_red', new StaticColorGradientEffect([BLACK, RED]));
add('gradient_black_green', new StaticColorGradientEffect([BLACK, GREEN]));
add('gradient_black_blue', new StaticColorGradientEffect([BLACK, BLUE]));
add('gradient_black_white', new StaticColorGradientEffect([BLACK, WHITE]));
add('gradient_custom', new StaticCustomColorGradientEffect());
add('two_alternating_colors', new TwoAlternatingColorFadingEffect(RED, BLUE));
add('two_alternating_colors_custom', new TwoAlternatingCustomColorFadingEffect());
add('rainbow', new RainbowGradientEffect1D());
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
