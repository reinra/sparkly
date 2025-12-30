import { initContract, initClient } from '@ts-rest/core';
import { z } from 'zod';

const StatusResponseSchema = z.object({
  code: z.number(),
  product_name: z.string(),
  hardware_version: z.string(),
  bytes_per_led: z.number(),
  hw_id: z.string(),
  flash_size: z.number(),
  led_type: z.number(),
  product_code: z.string(),
  fw_family: z.string(),
  device_name: z.string(),
  uptime: z.string(),
  mac: z.string(),
  uuid: z.string(),
  max_supported_led: z.number(),
  number_of_led: z.number(),
  led_profile: z.string(),
  frame_rate: z.number(),
  movie_capacity: z.number(),
  copyright: z.string()
});

const LoginRequestSchema = z.object({
  challenge: z.string()
});

const LoginResponseSchema = z.object({
  code: z.number(),
  authentication_token: z.string(),
  authentication_token_expires_in: z.number(),
  "challenge-response": z.string()
});

const VerifyRequestSchema = z.object({
  "challenge-response": z.string()
});

const BasicResponseSchema = z.object({
  code: z.number()
});

enum Mode {
  off = "off",
  demo = "demo",
  effect = "effect",
  movie = "movie",
  rt = "rt",
}

const SetModeReqestSchema = z.object({
  mode: z.nativeEnum(Mode),
});

// Define API contract with ts-rest
const c = initContract();

const apiContract = c.router({
  getStatus: {
    method: 'GET',
    path: '/xled/v1/gestalt',
    responses: {
      200: StatusResponseSchema,
    },
  },
  login: {
    method: 'POST',
    path: '/xled/v1/login',
    body: LoginRequestSchema,
    responses: {
      200: LoginResponseSchema,
    },
  },
  verify: {
    method: 'POST', 
    path: '/xled/v1/verify',
    headers: z.object({
      "x-auth-token": z.string(),
    }),
    body: VerifyRequestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
  setMode: {
    method: 'POST',
    path: '/xled/v1/led/mode',
    headers: z.object({
      "x-auth-token": z.string(),
    }),
    body: SetModeReqestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
});

function expect200(response: {status: number}): asserts response is {status: 200} {
  if (response.status !== 200) {
    throw new Error('Unexpected status code: ' + status);
  }
}
function expect1000(responseBody: {code: number}): asserts responseBody is {code: 1000} {
  if (responseBody.code !== 1000) {
    throw new Error('Unexpected response code: ' + responseBody.code);
  }
}
// Sample REST API client implementation using ts-rest properly
async function callApi() {
  const ip = '192.168.0.105';
  const baseUrl = 'http://' + ip;

  // Create ts-rest client - NOW YOU ONLY DEFINE PATHS ONCE!
  const noAuthClient = initClient(apiContract, {
    baseUrl: baseUrl,
    throwOnUnknownStatus: true,
  });

  try {
    console.log('\nFetching device status...');
    const statusReult = await noAuthClient.getStatus();
    expect200(statusReult);
    expect1000(statusReult.body);
    console.log('Status Response validated:', JSON.stringify(statusReult.body, null, 2));

   const challenge = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
    console.log('\nSending login request with challenge...');
    const loginResult = await noAuthClient.login({
      body: {
        challenge: challenge 
      }
    });
    expect200(loginResult);
    expect1000(loginResult.body);
    console.log('Login Response validated:', JSON.stringify(loginResult.body, null, 2));
        
    const client = initClient(apiContract, {
      baseUrl: baseUrl,
      throwOnUnknownStatus: true,
      baseHeaders: {
        "x-auth-token": loginResult.body.authentication_token
      },
    });

    console.log('\nSending verify request...');
    const verifyResult = await client.verify({
      body: {
        "challenge-response": loginResult.body["challenge-response"]
      }
    });
    expect200(verifyResult);
    expect1000(verifyResult.body);
    console.log('Verify Response validated:', JSON.stringify(verifyResult.body, null, 2));
    if (verifyResult.body.code !== 1000) {
      throw new Error('Verification failed with code: ' + verifyResult.body.code);
    }

    console.log('\nSetting device mode to "demo"...');
    const setModeResult = await client.setMode({
      body: {
        mode: Mode.demo
      }
    });
    expect200(setModeResult);
    expect1000(setModeResult.body);
    console.log('Set Mode Response validated:', JSON.stringify(setModeResult.body, null, 2));

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', JSON.stringify(error.errors, null, 2));
    } else {
      console.error('Error:', error);
    }
  }
}

console.log('Hello Twinkly Example with ts-rest & Zod\n');
callApi();
