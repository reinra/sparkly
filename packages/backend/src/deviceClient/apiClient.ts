import { initClient, tsRestFetchApi } from '@ts-rest/core';
import type { ApiFetcher } from '@ts-rest/core';
import { z } from 'zod';
import { closeUdpSocket, sendLedValues } from './udpSend';
import { apiContract, Mode, EnabledDisabledSchema, AbsoluteOrRelativeSchema } from './apiContract';
import { logger } from '../logger';
import { config } from 'process';

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

  constructor(
    public readonly deviceIp: string,
    cause?: Error
  ) {
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
export type GestaltResponseType = z.infer<(typeof apiContract.gestalt.responses)[200]>;
export type GetLedMovieConfigResponseType = z.infer<(typeof apiContract.getLedMovieConfig.responses)[200]>;
export type SetLedMovieConfigRequestType = z.infer<typeof apiContract.setLedMovieConfig.body>;
export type MovieFullResponseType = z.infer<(typeof apiContract.postMovieFull.responses)[200]>;

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
   * Log request with appropriate level based on body size (trace for >2k bytes, debug otherwise)
   */
  private logRequest(args: Parameters<ApiFetcher>[0]) {
    const bodySize = args.body ? JSON.stringify(args.body).length : 0;
    if (bodySize > 2000) {
      logger.debug(`Making request to ${args.method} ${args.path}`);
      logger.withMetadata({ body: args.body }).trace(`Making request to ${args.method} ${args.path}`);
    } else {
      logger.withMetadata({ body: args.body }).debug(`Making request to ${args.method} ${args.path}`);
    }
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
          // Only apply default timeout if no signal is already provided
          signal: args.fetchOptions?.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
      this.logRequest(args);
      return await this.fetchWithErrorHandling(args);
    };
  }

  /**
   * Direct fetch for binary data bypassing ts-rest serialization
   * Useful for endpoints that need to send raw binary data without JSON encoding
   */
  private async fetchBinary(
    path: string,
    binaryData: Uint8Array,
    options?: {
      method?: string;
      timeout?: number;
      extraHeaders?: Record<string, string>;
    }
  ): Promise<any> {
    const method = options?.method || 'POST';
    const timeout = options?.timeout || REQUEST_TIMEOUT_MS;

    logger
      .withMetadata({
        method,
        path,
        dataSize: binaryData.byteLength,
        timeout,
      })
      .debug('Making direct binary fetch request');

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'x-auth-token': this.authenticationToken!,
          'Content-Type': 'application/octet-stream',
          ...options?.extraHeaders,
        },
        body: binaryData as BodyInit,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
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
      this.logRequest(args);
      const response = await this.fetchWithErrorHandling(argsWithAuth);

      // If we get a 401, attempt to recover by re-authenticating and retrying once
      if (response.status === 401) {
        logger.debug('Received 401 Unauthorized. Clearing token and re-authenticating');

        // Clear the invalid token
        this.authenticationToken = null;

        // Re-authenticate
        await this.login();

        // Retry the original request with the new token
        logger.debug('Retrying request with new token');
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
    logger.debug('Fetching device gestalt');
    const result = await this.clientNoAuth.gestalt();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).trace('Gestalt Response validated');
    this.lastGestaltResponse = result.body;
    return result.body;
  }

  async getSummary() {
    await this.ensureAuthenticated();
    logger.debug('Fetching device summary');
    const result = await this.client.summary();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).trace('Summary Response validated');
    return result.body;
  }

  private async login() {
    logger.debug('Sending login request with challenge');
    const loginResult = await this.clientNoAuth.login({
      body: {
        challenge: challenge,
      },
    });
    expect200(loginResult);
    expect1000(loginResult.body);
    logger.withMetadata({ response: loginResult.body }).debug('Login Response validated');
    this.authenticationToken = loginResult.body.authentication_token;

    logger.debug('Sending verify request');
    const verifyResult = await this.client.verify({
      body: {
        'challenge-response': loginResult.body['challenge-response'],
      },
    });
    expect200(verifyResult);
    expect1000(verifyResult.body);
    logger.withMetadata({ response: verifyResult.body }).debug('Verify Response validated');
  }

  async setMode(mode: Mode) {
    await this.ensureAuthenticated();

    logger.debug(`Setting device mode to "${mode}"`);
    const result = await this.client.setMode({
      body: {
        mode,
      },
    });
    expect200(result);
    expect1000((result as any).body);
    logger.withMetadata({ response: (result as any).body }).debug('Set Mode Response validated');
  }

  async setBrightnessAbsolute(value: number) {
    await this.ensureAuthenticated();
    logger.debug(`Setting brightness to absolute value ${value}`);
    const result = await this.client.setBrightness({
      body: {
        mode: EnabledDisabledSchema.enum.enabled,
        type: AbsoluteOrRelativeSchema.enum.A,
        value,
      },
    });
    expect200(result);
    expect1000((result as any).body);
    logger.withMetadata({ response: (result as any).body }).debug('Set Brightness Response validated');
  }

  async setSaturationAbsolute(value: number) {
    await this.ensureAuthenticated();
    logger.debug(`Setting saturation to absolute value ${value}`);
    const result = await this.client.setSaturation({
      body: {
        mode: EnabledDisabledSchema.enum.enabled,
        type: AbsoluteOrRelativeSchema.enum.A,
        value,
      },
    });
    expect200(result);
    expect1000((result as any).body);
    logger.withMetadata({ response: (result as any).body }).debug('Set Saturation Response validated');
  }

  async listMovies() {
    await this.ensureAuthenticated();
    logger.debug('Listing movies');
    const result = await this.client.listMovies();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('List Movies Response validated');
    return result.body;
  }

  async getLayout() {
    await this.ensureAuthenticated();
    logger.debug('Fetching LED layout');
    const result = await this.client.getLayout();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('Get Layout Response validated');
    return result.body;
  }

  async getLedConfig() {
    await this.ensureAuthenticated();
    logger.debug('Fetching LED config');
    const result = await this.client.getLedConfig();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('Get LED Config Response validated');
    return result.body;
  }

  async sendLedValues(ledValues: number[]) {
    await this.ensureGestaltFetched();
    await this.ensureAuthenticated();

    logger.withMetadata({ ledCount: ledValues.length / 3 }).trace('Sending LED values over UDP');
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

  async postMovieFull(movieData: Buffer): Promise<MovieFullResponseType> {
    await this.ensureAuthenticated();

    // Convert Buffer to Uint8Array for fetch API
    const binaryData = new Uint8Array(movieData);

    logger.debug('Posting full movie data');

    // Use direct fetch to avoid ts-rest serializing the binary data
    const result = await this.fetchBinary('/xled/v1/led/movie/full', binaryData, {
      timeout: 20000,
    });

    expect1000(result);
    logger.withMetadata({ response: result }).debug('Post Movie Full Response validated');
    return result as MovieFullResponseType;
  }

  async getLedMovieConfig() {
    await this.ensureAuthenticated();
    logger.debug('Fetching LED movie config');
    const result = await this.client.getLedMovieConfig();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('Get LED Movie Config Response validated');
    return result.body;
  }

  async setLedMovieConfig(config: SetLedMovieConfigRequestType) {
    await this.ensureAuthenticated();
    logger.debug('Setting LED movie config');
    const result = await this.client.setLedMovieConfig({
      body: config,
    });
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('Set LED Movie Config Response validated');
  }

  async getLedEffects() {
    await this.ensureAuthenticated();
    logger.debug('Fetching LED effects');
    const result = await this.client.getLedEffects();
    expect200(result);
    expect1000(result.body);
    logger.withMetadata({ response: result.body }).debug('Get LED Effects Response validated');
    return result.body;
  }

  async close() {
    await closeUdpSocket();
  }
}
