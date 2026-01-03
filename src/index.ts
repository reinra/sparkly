import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';
import { SimpleColorEffect, SmoothSameColorEffect } from './effects/SameColorEffect';
import { GradientStaticFrameEffect, StaticFrameEffect } from './effects/StaticFrameEffect';
import { AnyEffectRenderer } from './effects/Renderer';

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
    
    // const effect = new SmoothSameColorEffect(new SimpleColorEffect(), 64);    
    const effect = new GradientStaticFrameEffect({ red: 255, green: 0, blue: 0 }, { red: 255, green: 255, blue: 0 });

    const renderer = new AnyEffectRenderer();
    await renderer.render(effect, apiClient);
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
