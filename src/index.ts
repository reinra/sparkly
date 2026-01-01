import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';
import { SimpleColorEffect, SmoothSameColorEffect } from './effects/Effect';

// Sample REST API client implementation using ts-rest properly
async function callApi() {
  const ip = '192.168.0.105';

  const apiClient = new TwinklyApiClient(ip);
  try {
    const status = await apiClient.gestalt();

    await apiClient.getSummary();

    await apiClient.setMode(Mode.rt);
    
    await apiClient.setBrightnessAbsolute(100);

    const effect = new SmoothSameColorEffect(new SimpleColorEffect(), 64);
    const colors = effect.getColors();
    const iterationCount = 1000;
    for (let i = 0; i < iterationCount; i++) {
      await sleep(10);
      const rgb = colors[Symbol.iterator]().next().value;
      const ledValues: number[] = [];
      for (let i = 0; i < status.number_of_led; i++) {
        ledValues.push(rgb.red, rgb.green, rgb.blue);        
      }
      console.log(`\nSending LED values of ${JSON.stringify(rgb)} to ${ip}...`);
      await apiClient.sendLedValues(ledValues);
    }

  
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

async function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

