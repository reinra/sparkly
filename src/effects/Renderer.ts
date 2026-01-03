
import { TwinklyApiClient } from '../apiClient';
import { hasWhiteChannel, LedType, LedValue } from './Color';
import { SameColorEffect } from './SameColorEffect';
import { StaticStripEffect } from './StaticStripEffect';

export interface Renderer<T> {
    render(effect: T, apiClient: TwinklyApiClient): void;
}

type AnyEffect = SameColorEffect | StaticStripEffect;

export class AnyEffectRenderer implements Renderer<AnyEffect> {
    private readonly sameColorEffectRenderer = new SameColorEffectRenderer();
    private readonly staticStripEffectRenderer = new StaticStripEffectRenderer();
    async render(effect: AnyEffect, apiClient: TwinklyApiClient) {
        if ('getColors' in effect) {
            await this.sameColorEffectRenderer.render(effect, apiClient);
        } else if ('getFrame' in effect) {
            await this.staticStripEffectRenderer.render(effect, apiClient);
        } else {
            throw new Error(`Unsupported effect type: ${(effect as any).constructor?.name ?? 'unknown'}`);
        }
    }
}

export class SameColorEffectRenderer implements Renderer<SameColorEffect> {
    async render(effect: SameColorEffect, apiClient: TwinklyApiClient) {
        const gestalt = await apiClient.gestalt();
        const numberOfLeds = gestalt.number_of_led;
        const colors = effect.getColors();
        const maxIterations = 1000;
        let i = 0;
        for (const color of colors) {
            const ledValues: number[] = [];
            for (let i = 0; i < numberOfLeds; i++) {
                await copyValues(color, gestalt.led_profile, ledValues);
            }
            console.log(`\nSending '${effect.getName()}' LED values of ${JSON.stringify(color)} to ${apiClient.getIp()}...`);
            await apiClient.sendLedValues(ledValues);

            i++;
            if (i >= maxIterations) {
                break;
            }
            await sleep(10);
        }
    }
}

export class StaticStripEffectRenderer implements Renderer<StaticStripEffect> {
    async render(effect: StaticStripEffect, apiClient: TwinklyApiClient) {
        const gestalt = await apiClient.gestalt();
        const numberOfLeds = gestalt.number_of_led;
        const frame = effect.getFrame({ led_type: gestalt.led_profile, led_count: numberOfLeds });
        const ledValues: number[] = [];
        for (const color of frame) {
            await copyValues(color, gestalt.led_profile, ledValues);
        }
        console.log(`\nSending '${effect.getName()}' ${numberOfLeds} LED values to ${apiClient.getIp()}...`);
        await apiClient.sendLedValues(ledValues);
    }
}

async function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function copyValues(color: LedValue, targetType: LedType, output: number[]) {
    if (targetType === LedType.RGB) {
        // Ignore white even if provided
        output.push(color.red, color.green, color.blue);
    }
    else if (hasWhiteChannel(color)) {
        output.push(color.white, color.red, color.green, color.blue);
    }
    else {
        output.push(0, color.red, color.green, color.blue);
    }
}
