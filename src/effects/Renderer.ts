
import { TwinklyApiClient } from '../apiClient';
import { LedType } from './Color';
import { SameColorEffect } from './SameColorEffect';
import { StaticFrameEffect } from './StaticFrameEffect';

export interface Renderer<T> {
    render(effect: T, apiClient: TwinklyApiClient): void;
}

type AnyEffect = SameColorEffect | StaticFrameEffect;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
    private readonly sameColorEffectRenderer = new SameColorEffectRenderer();
    private readonly staticFrameEffectRenderer = new StaticFrameEffectRenderer();
    async render(effect: AnyEffect, apiClient: TwinklyApiClient) {
        if ('getColors' in effect) {
            await this.sameColorEffectRenderer.render(effect, apiClient);
        } else if ('getFrame' in effect) {
            await this.staticFrameEffectRenderer.render(effect, apiClient);
        } else {
            throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
        }
    }
}

export class SameColorEffectRenderer implements Renderer<SameColorEffect> {
    async render(effect: SameColorEffect, apiClient: TwinklyApiClient) {
        const numberOfLeds = (await apiClient.gestalt()).number_of_led;
        const colors = effect.getColors();
        const iterationCount = 1000;
        for (let i = 0; i < iterationCount; i++) {
            await sleep(10);
            const rgb = colors[Symbol.iterator]().next().value;
            const ledValues: number[] = [];
            for (let i = 0; i < numberOfLeds; i++) {
                ledValues.push(rgb.red, rgb.green, rgb.blue);
            }
            console.log(`\nSending '${effect.getName()}' LED values of ${JSON.stringify(rgb)} to ${apiClient.getIp()}...`);
            await apiClient.sendLedValues(ledValues);
        }
    }
}

export class StaticFrameEffectRenderer implements Renderer<StaticFrameEffect> {
    async render(effect: StaticFrameEffect, apiClient: TwinklyApiClient) {
        const numberOfLeds = (await apiClient.gestalt()).number_of_led;
        const frame = effect.getFrame({ led_type: LedType.RGB, led_count: numberOfLeds });
        const ledValues: number[] = [];
        for (const color of frame) {
            ledValues.push(color.red, color.green, color.blue);
        }
        console.log(`\nSending '${effect.getName()}' ${numberOfLeds} LED values to ${apiClient.getIp()}...`);
        await apiClient.sendLedValues(ledValues);
    }
}

async function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
