import { initClient, ApiFetcher } from '@ts-rest/core';
import { z } from 'zod';
import { closeUdpSocket, sendLedValues } from './udpSend';
import { apiContract, Mode, EnabledDisabledSchema, AbsoluteOrRelativeSchema } from './apiContract';
import { resourceLimits } from 'worker_threads';

const challenge = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const UDP_PORT = 7777;

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
   * Custom API fetcher that handles 401 responses by clearing token, re-logging in, and retrying once
   */
  private createApiFetcherWithRetry(): ApiFetcher {
    return async (args) => {
      const { path, method, headers, body } = args;

      // Build the full URL
      const url = path;

      // Add auth token to headers if available
      const requestHeaders = {
        ...headers,
        ...(this.authenticationToken ? { 'x-auth-token': this.authenticationToken } : {}),
      } as Record<string, string>;

      // Make the initial request
      console.log(`Making request to ${method} ${url} with body: ${JSON.stringify(body)}`);
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      // If we get a 401, attempt to recover by re-authenticating and retrying once
      if (response.status === 401) {
        console.log('Received 401 Unauthorized. Clearing token and re-authenticating...');

        // Clear the invalid token
        this.authenticationToken = null;

        // Re-authenticate
        await this.login();

        // Retry the original request with the new token
        console.log('Retrying request with new token...');
        const newHeaders = {
          ...headers,
          'x-auth-token': this.authenticationToken!,
        } as Record<string, string>;

        const retryResponse = await fetch(url, {
          method,
          headers: newHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        return {
          status: retryResponse.status,
          body: await retryResponse.json(),
          headers: retryResponse.headers as any,
        };
      }

      // Parse response body
      let responseBody;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      return {
        status: response.status,
        body: responseBody,
        headers: response.headers as any,
      };
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
