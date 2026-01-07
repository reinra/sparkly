import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';
import { AnyEffectRenderer } from './effects/Renderer';
import { loadConfig } from './config';
import { IdentityLedMapper, ReverseLedMapper, SegmentedLedMapper } from './effects/LedMapper';
import type { LedMapper } from './effects/LedMapper';
import { effects } from './effects/EffectLibrary';

// Sample REST API client implementation using ts-rest properly
async function callApi(this: any) {
  // Load configuration from TOML file
  const config = loadConfig();
  const ip = config.device[0].ip;

  const apiClient = new TwinklyApiClient(ip);
  try {
    await apiClient.gestalt();

    await apiClient.getSummary();

    await apiClient.listMovies();
    await apiClient.getLayout();
    const ledConfig = await apiClient.getLedConfig();

    await apiClient.setMode(Mode.rt);

    // await apiClient.setBrightnessAbsolute(100);

    const effect = effects['rotating_gradient_4'];

    let mapper: LedMapper = new IdentityLedMapper();
    if (ledConfig.strings.length === 2) {
      const halfLength = ledConfig.strings[0].length;
      mapper = new SegmentedLedMapper([
        { startIndex: 0, mapper: new ReverseLedMapper(halfLength) },
        { startIndex: halfLength, mapper: new IdentityLedMapper() },
      ]);
    }

    const renderer = new AnyEffectRenderer();
    await renderer.render(effect, apiClient, mapper);
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
