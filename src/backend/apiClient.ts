import { initClient, tsRestFetchApi } from '@ts-rest/core';
import type { ApiFetcher } from '@ts-rest/core';
import { z } from 'zod';
import { closeUdpSocket, sendLedValues } from './udpSend';
import { apiContract, Mode, EnabledDisabledSchema, AbsoluteOrRelativeSchema } from '../apiContract';

const challenge = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const UDP_PORT = 7777;
const REQUEST_TIMEOUT_MS = 1000; // 1 second timeout for device requests
const NETWORK_ERROR_KEYWORDS = [
  'fetch failed',
  'econnrefused',
  'etimedout',
  'enotfound',
  'enetunreach',
  'ehostunreach',
];

function expect200(response: { status: number }): asserts response is { status: 200 } {
  if (response.status !== 200) {
    throw new Error('Unexpected status code: ' + status);
  }
}
function expect1000(responseBody: { code: number }): asserts responseBody is { code: 1000 } {
  if (responseBody.code !== 1000) {
    throw new Error('Unexpected response code: ' + responseBody.code);
  }
}

/**
 * Custom error class for device connectivity issues
 */
export class DeviceUnreachableError extends Error {
  public readonly cause?: Error;

  constructor(public readonly deviceIp: string, cause?: Error) {
    super(
      `Twinkly device unreachable at ${deviceIp}. Please check if the device is powered on and connected to the network.`
    );
    this.name = 'DeviceUnreachableError';
    this.cause = cause;
  }
}

const dummyNoAuthClient = initClient(apiContract, {
  baseUrl: 'http://localhost',
});
const dummyClient = initClient(apiContract, {
  baseUrl: 'http://localhost',
  baseHeaders: {
    'x-auth-token': 'dummy',
  },
});

type ApiNoAuthClientType = typeof dummyNoAuthClient;
type ApiClientType = typeof dummyClient;
type GestaltResponseType = z.infer<(typeof apiContract.gestalt.responses)[200]>;

export class TwinklyApiClient {
  private readonly baseUrl: string;
  private readonly clientNoAuth: ApiNoAuthClientType;
  private authenticationToken: string | null = null;
  private readonly client: ApiClientType;
  private lastGestaltResponse: GestaltResponseType | null = null;

  constructor(private readonly ip: string) {
    this.baseUrl = 'http://' + ip;
    this.clientNoAuth = initClient(apiContract, {
      baseUrl: this.baseUrl,
      throwOnUnknownStatus: true,
      api: this.createApiFetcherWithErrorHandling(),
    });
    // Initialize authenticated client with custom fetcher
    // Note: We don't use baseHeaders because the custom fetcher adds the token dynamically
    this.client = initClient(apiContract, {
      baseUrl: this.baseUrl,
      throwOnUnknownStatus: true,
      api: this.createApiFetcherWithRetry(),
      jsonQuery: true,
    });
  }

  /**
   * Helper to make a request using tsRestFetchApi and wrap network errors with DeviceUnreachableError
   */
  private async fetchWithErrorHandling(
    args: Parameters<ApiFetcher>[0]
  ): Promise<{ status: number; body: any; headers: any }> {
    try {
      return await tsRestFetchApi({
        ...args,
        fetchOptions: {
          ...args.fetchOptions,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      });
    } catch (error) {
      // Wrap network errors with DeviceUnreachableError
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('aborted') || NETWORK_ERROR_KEYWORDS.some((keyword) => message.includes(keyword))) {
          throw new DeviceUnreachableError(this.ip, error);
        }
      }
      throw error;
    }
  }

  /**
   * Simple API fetcher that wraps network errors with DeviceUnreachableError
   */
  private createApiFetcherWithErrorHandling(): ApiFetcher {
    return async (args) => {
      console.log(`Making request to ${args.method} ${args.path} with body: ${JSON.stringify(args.body)}`);
      return await this.fetchWithErrorHandling(args);
    };
  }

  /**
   * Custom API fetcher that handles 401 responses by clearing token, re-logging in, and retrying once
   * Also wraps network errors with DeviceUnreachableError for better error handling
   */
  private createApiFetcherWithRetry(): ApiFetcher {
    return async (args) => {
      // Add auth token to headers if available
      const argsWithAuth = {
        ...args,
        headers: {
          ...args.headers,
          ...(this.authenticationToken ? { 'x-auth-token': this.authenticationToken } : {}),
        },
      };

      // Make the initial request
      console.log(`Making request to ${args.method} ${args.path} with body: ${JSON.stringify(args.body)}`);
      const response = await this.fetchWithErrorHandling(argsWithAuth);

      // If we get a 401, attempt to recover by re-authenticating and retrying once
      if (response.status === 401) {
        console.log('Received 401 Unauthorized. Clearing token and re-authenticating...');

        // Clear the invalid token
        this.authenticationToken = null;

        // Re-authenticate
        await this.login();

        // Retry the original request with the new token
        console.log('Retrying request with new token...');
        const retryArgs = {
          ...args,
          headers: {
            ...args.headers,
            'x-auth-token': this.authenticationToken!,
          },
        };

        return await this.fetchWithErrorHandling(retryArgs);
      }

      return response;
    };
  }

  getIp(): string {
    return this.ip;
  }

  private async ensureGestaltFetched() {
    if (!this.lastGestaltResponse) {
      await this.gestalt();
    }
  }
  private async ensureAuthenticated() {
    if (!this.authenticationToken) {
      await this.login();
    }
  }

  async gestalt() {
    console.log('\nFetching device status...');
    const result = await this.clientNoAuth.gestalt();
    expect200(result);
    expect1000(result.body);
    console.log('Status Response validated:', JSON.stringify(result.body, null, 2));
    this.lastGestaltResponse = result.body;
    return result.body;
  }

  async getSummary() {
    await this.ensureAuthenticated();
    console.log('\nFetching device summary...');
    const result = await this.client.summary();
    expect200(result);
    expect1000(result.body);
    console.log('Summary Response validated:', JSON.stringify(result.body, null, 2));
    return result.body;
  }

  private async login() {
    console.log('\nSending login request with challenge...');
    const loginResult = await this.clientNoAuth.login({
      body: {
        challenge: challenge,
      },
    });
    expect200(loginResult);
    expect1000(loginResult.body);
    console.log('Login Response validated:', JSON.stringify(loginResult.body, null, 2));
    this.authenticationToken = loginResult.body.authentication_token;

    console.log('\nSending verify request...');
    const verifyResult = await this.client.verify({
      body: {
        'challenge-response': loginResult.body['challenge-response'],
      },
    });
    expect200(verifyResult);
    expect1000(verifyResult.body);
    console.log('Verify Response validated:', JSON.stringify(verifyResult.body, null, 2));
  }

  async setMode(mode: Mode) {
    await this.ensureAuthenticated();

    console.log(`\nSetting device mode to "${mode}"...`);
    const result = await this.client.setMode({
      body: {
        mode,
      },
    });
    expect200(result);
    expect1000((result as any).body);
    console.log('Set Mode Response validated:', JSON.stringify((result as any).body, null, 2));
  }

  async setBrightnessAbsolute(value: number) {
    await this.ensureAuthenticated();
    console.log(`\nSetting brightness to absolute value ${value}...`);
    const result = await this.client.setBrightness({
      body: {
        mode: EnabledDisabledSchema.enum.enabled,
        type: AbsoluteOrRelativeSchema.enum.A,
        value,
      },
    });
    expect200(result);
    expect1000((result as any).body);
    console.log('Set Brightness Response validated:', JSON.stringify((result as any).body, null, 2));
  }

  async listMovies() {
    await this.ensureAuthenticated();
    console.log(`\nListing movies...`);
    const result = await this.client.listMovies();
    expect200(result);
    expect1000(result.body);
    console.log('List Movies Response validated:', JSON.stringify(result.body, null, 2));
    return result.body;
  }

  async getLayout() {
    await this.ensureAuthenticated();
    console.log(`\nFetching LED layout...`);
    const result = await this.client.getLayout();
    expect200(result);
    expect1000(result.body);
    console.log('Get Layout Response validated:', JSON.stringify(result.body, null, 2));
    return result.body;
  }

  async getLedConfig() {
    await this.ensureAuthenticated();
    console.log(`\nFetching LED config...`);
    const result = await this.client.getLedConfig();
    expect200(result);
    expect1000(result.body);
    console.log('Get LED Config Response validated:', JSON.stringify(result.body, null, 2));
    return result.body;
  }

  async sendLedValues(ledValues: number[]) {
    await this.ensureGestaltFetched();
    await this.ensureAuthenticated();

    console.log(`\nSending LED values over UDP...`);
    await sendLedValues(
      {
        authentication_token: this.authenticationToken!,
        led_count: this.lastGestaltResponse!.number_of_led,
        led_values: ledValues,
      },
      UDP_PORT,
      this.ip
    );
  }

  async close() {
    await closeUdpSocket();
  }
}
