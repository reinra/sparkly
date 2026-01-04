import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';
import { GradientStaticStripEffect } from './effects/StaticStripEffect';
import { AnyEffect, AnyEffectRenderer } from './effects/Renderer';
import { SimpleColorEffect, SmoothSameColorEffect } from './effects/SameColorEffect';
import { RotatingStrictEffect, TestPerLedEffect } from './effects/StripEffect';
import { loadConfig } from './config';

// Sample REST API client implementation using ts-rest properly
async function callApi(this: any) {
  // Load configuration from TOML file
  const config = loadConfig();
  const ip = config.device.ip;

  const apiClient = new TwinklyApiClient(ip);
  try {
    await apiClient.gestalt();

    await apiClient.getSummary();

    await apiClient.listMovies();
    await apiClient.getLayout();
    await apiClient.getLedConfig();

    await apiClient.setMode(Mode.rt);

    // await apiClient.setBrightnessAbsolute(100);

    const gradient4 = new GradientStaticStripEffect([
      { red: 255, green: 0, blue: 0 },
      { red: 0, green: 255, blue: 0 },
      { red: 0, green: 0, blue: 255 },
      { red: 255, green: 0, blue: 0 },
    ]);

    const effects: Record<string, AnyEffect> = {
      simple: new SimpleColorEffect(),
      smooth: new SmoothSameColorEffect(new SimpleColorEffect(), 64),
      gradient_2: new GradientStaticStripEffect([
        { red: 255, green: 0, blue: 0 },
        { red: 255, green: 255, blue: 0 },
      ]),
      gradient_3: new GradientStaticStripEffect([
        { red: 255, green: 0, blue: 0 },
        { red: 0, green: 255, blue: 0 },
        { red: 0, green: 0, blue: 255 },
      ]),
      gradient_4: gradient4,
      rotating_gradient_4: new RotatingStrictEffect(gradient4, 400, 3),
      test_per_led: new TestPerLedEffect(),
    };

    const effect = effects['test_per_led'];

    const renderer = new AnyEffectRenderer();
    await renderer.render(effect, apiClient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', JSON.stringify(error.errors, null, 2));
    } else {
      console.error('Error:', error);
    }
  } finally {
    await apiClient.close();
  }
}

process.on('exit', (code) => {
  console.log(`\nProgram exiting with code: ${code}`);
});

console.log('Hello Twinkly Example with ts-rest & Zod\n');
callApi();
