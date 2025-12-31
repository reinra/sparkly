import { z } from 'zod';
import { Mode } from './apiContract';
import { TwinklyApiClient } from './apiClient';

// Sample REST API client implementation using ts-rest properly
async function callApi() {
  const ip = '192.168.0.105';

  const apiClient = new TwinklyApiClient(ip);
  try {
    const status = await apiClient.getStatus();
    await apiClient.setMode(Mode.rt);
    
    const color = [255, 255, 0];
    const ledValues: number[] = [];
    for (let i = 0; i < status.number_of_led; i++) {
      ledValues.push(...color);
    }
    console.log(`\nSending LED values of ${color} to ${ip}...`);
    await apiClient.sendLedValues(ledValues);
  
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
