import { type RgbFloat, BLACK } from '../../color/ColorFloat';
import { EffectParameterStorage, EffectParameterView, MultiParameterStorageView } from '../../effectParameters';
import { ParameterType } from '../../ParameterTypes';
import {
  AnimationMode,
  type EffectStatic,
  type EffectContextStatic,
  type LedPoint1D,
  type EffectLogic,
} from '../Effect';
import { createBlackBuffer, createShuffledIndices } from '../util/ArrayUtils';
import { PaletteParameters } from '../util/Palette';

/**
 * Static random dots — generates a single frame with randomly placed colored dots.
 * Coverage controls what percentage of LEDs are lit.
 */
export class RandomDotsStaticEffect implements EffectStatic<LedPoint1D> {
  readonly animationMode = AnimationMode.Static;
  pointType: '1D' = '1D';
  isStateful: boolean = true;
  readonly effectId = 'random_dots_static';
  readonly effectName = 'Random Dots (Static)';

  private dirty: boolean = true;
  private readonly invalidate = () => {
    this.dirty = true;
  };

  readonly customParams = new EffectParameterStorage();
  private readonly coverage = this.customParams.register(
    {
      id: 'coverage',
      name: 'Coverage',
      description: 'Approximate percentage of LEDs lit (0.0 - 100.0)%',
      type: ParameterType.RANGE,
      value: 50,
      min: 0,
      max: 100,
      unit: '%',
    },
    this.invalidate
  );

  readonly palette = new PaletteParameters();

  public readonly parameters = new MultiParameterStorageView(
    new Map<string, EffectParameterView>([
      ['custom.', this.customParams],
      ['palette.', this.palette.parameters],
    ])
  );

  constructor() {
    const origOnUpdate = this.palette.onUpdate.bind(this.palette);
    this.palette.onUpdate = () => {
      origOnUpdate();
      this.invalidate();
    };
  }

  createLogic(): EffectLogic<AnimationMode.Static, LedPoint1D> {
    let cachedBuffer: RgbFloat[] | null = null;
    let cachedTotal: number = 0;

    return {
      renderGlobal: (_ctx: EffectContextStatic, points: LedPoint1D[]): RgbFloat[] => {
        const total = points.length;

        if (cachedBuffer && cachedTotal === total && !this.dirty) {
          return cachedBuffer;
        }
        this.dirty = false;

        const litCount = Math.max(1, Math.round(total * (this.coverage.value / 100)));
        const buffer = createBlackBuffer(total);

        // Build shuffled indices and pick the first litCount
        const indices = createShuffledIndices(total);

        for (let i = 0; i < litCount; i++) {
          buffer[indices[i]] = this.palette.palette.nextColor().asRgb();
        }

        cachedBuffer = buffer;
        cachedTotal = total;
        return buffer;
      },
    };
  }
}
