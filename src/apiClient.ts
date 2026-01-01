import { initClient } from '@ts-rest/core';
import { z } from 'zod';
import { closeUdpSocket, sendLedValues } from './udpSend';
import { apiContract, Mode, EnabledDisabledSchema, AbsoluteOrRelativeSchema } from './apiContract';

const challenge = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const UDP_PORT = 7777;

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

const dummyNoAuthClient = initClient(apiContract, {
    baseUrl: 'http://localhost'
});
const dummyClient = initClient(apiContract, {
    baseUrl: 'http://localhost',
    baseHeaders: {
        "x-auth-token": "dummy"
    }
});

type ApiNoAuthClientType = typeof dummyNoAuthClient;
type ApiClientType = typeof dummyClient;
type GestaltResponseType = z.infer<typeof apiContract.gestalt.responses[200]>;

export class TwinklyApiClient {
    private readonly baseUrl: string;
    private readonly clientNoAuth: ApiNoAuthClientType;
    private authenticationToken: string | null = null
    private client: ApiClientType | null = null;
    private lastGestaltResponse: GestaltResponseType | null = null;
    constructor(private readonly ip: string) {
        this.baseUrl = 'http://' + ip;
        this.clientNoAuth = initClient(apiContract, {
            baseUrl: this.baseUrl,
            throwOnUnknownStatus: true,
        });
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
        const result = await this.client!.summary();
        expect200(result);
        expect1000(result.body);
        console.log('Summary Response validated:', JSON.stringify(result.body, null, 2));
        return result.body;
    }

    private async login() {
        console.log('\nSending login request with challenge...');
        const loginResult = await this.clientNoAuth.login({
        body: {
            challenge: challenge 
        }
        });
        expect200(loginResult);
        expect1000(loginResult.body);
        console.log('Login Response validated:', JSON.stringify(loginResult.body, null, 2));
        this.authenticationToken = loginResult.body.authentication_token;
        const client = initClient(apiContract, {
        baseUrl: this.baseUrl,
        throwOnUnknownStatus: true,
        baseHeaders: {
            "x-auth-token": loginResult.body.authentication_token
             },
        });
        this.client = client;

        console.log('\nSending verify request...');
        const verifyResult = await client.verify({
        body: {
            "challenge-response": loginResult.body["challenge-response"]
        }
        });
        expect200(verifyResult);
        expect1000(verifyResult.body);
        console.log('Verify Response validated:', JSON.stringify(verifyResult.body, null, 2));
    }

    async setMode(mode: Mode) {
        await this.ensureAuthenticated();

        console.log(`\nSetting device mode to "${mode}"...`);
        const result = await this.client!.setMode({
        body: {
            mode
        }
        });
        expect200(result);
        expect1000((result as any).body);
        console.log('Set Mode Response validated:', JSON.stringify((result as any).body, null, 2));
    }

    async setBrightnessAbsolute(value: number) {
        await this.ensureAuthenticated();
        console.log(`\nSetting brightness to absolute value ${value}...`);
        const result = await this.client!.setBrightness({
            body: {
                mode: EnabledDisabledSchema.enum.enabled,
                type: AbsoluteOrRelativeSchema.enum.A,
                value
            }
            });
        expect200(result);
        expect1000((result as any).body);
        console.log('Set Brightness Response validated:', JSON.stringify((result as any).body, null, 2));
    }

    async sendLedValues(ledValues: number[]) {
        await this.ensureGestaltFetched();
        await this.ensureAuthenticated();

        console.log(`\nSending LED values over UDP...`);    
        await sendLedValues({
        authentication_token: this.authenticationToken!,
        led_count: this.lastGestaltResponse!.number_of_led,
        led_values: ledValues,
        }, UDP_PORT, this.ip);
    }

    async close() {
        await closeUdpSocket();
    }

}
