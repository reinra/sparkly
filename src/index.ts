import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';
import { SimpleColorEffect, SmoothSameColorEffect } from './effects/SameColorEffect';
import { GradientStaticFrameEffect, StaticFrameEffect } from './effects/StaticFrameEffect';
import { LedType } from './effects/Color';

// Sample REST API client implementation using ts-rest properly
async function callApi() {
  const ip = '192.168.0.105';

  const apiClient = new TwinklyApiClient(ip);
  try {
    const status = await apiClient.gestalt();

    await apiClient.getSummary();

    await apiClient.setMode(Mode.rt);
    
    await apiClient.setBrightnessAbsolute(100);

    const numberOfLeds = status.number_of_led;
    const effect = new SmoothSameColorEffect(new SimpleColorEffect(), 64);
    // await playSameColorEffect(effect, numberOfLeds, ip, apiClient);

    const frameEffect = new GradientStaticFrameEffect({ red: 255, green: 0, blue: 0 }, { red: 255, green: 255, blue: 0 });
    await playFrame(frameEffect, numberOfLeds, ip, apiClient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', JSON.stringify(error.errors, null, 2));
    } else {
      console.error('Error:', error);
    }
  }
  finally {
    await apiClient.close();
  }
  
}

process.on('exit', (code) => {
  console.log(`\nProgram exiting with code: ${code}`);
});

console.log('Hello Twinkly Example with ts-rest & Zod\n');
callApi();

async function playSameColorEffect(effect: SmoothSameColorEffect, numberOfLeds: number, ip: string, apiClient: TwinklyApiClient) {
  const colors = effect.getColors();
  const iterationCount = 1000;
  for (let i = 0; i < iterationCount; i++) {
    await sleep(10);
    const rgb = colors[Symbol.iterator]().next().value;
    const ledValues: number[] = [];
    for (let i = 0; i < numberOfLeds; i++) {
      ledValues.push(rgb.red, rgb.green, rgb.blue);
    }
    console.log(`\nSending '${effect.getName()}' LED values of ${JSON.stringify(rgb)} to ${ip}...`);
    await apiClient.sendLedValues(ledValues);
  }
}

async function playFrame(effect: StaticFrameEffect, numberOfLeds: number, ip: string, apiClient: TwinklyApiClient) {
  const frame = effect.getFrame({ led_type: LedType.RGB, led_count: numberOfLeds });
  const ledValues: number[] = [];
  for (const color of frame) {
    ledValues.push(color.red, color.green, color.blue);
  }
  console.log(`\nSending '${effect.getName()}' ${numberOfLeds} LED values to ${ip}...`);
  await apiClient.sendLedValues(ledValues);
}

async function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

