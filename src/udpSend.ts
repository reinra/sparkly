import dgram from 'dgram';
import { promisify } from 'util';

let client: dgram.Socket | null = null;

function getClient() {
  if (!client) {
    client = dgram.createSocket('udp4');
  }
  return client;
}

export async function sendMessage(message: string | Buffer, port: number, address: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = getClient();
    socket.send(message, port, address, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Message sent!');
        resolve();
      }
    });
  });
}

export async function sendLedValues(request: SetLedValuesRequestSchema, port: number, address: string) {
    const header = Buffer.from([0x01]); // Example header
    const authTokenBuffer = Buffer.from(request.authentication_token, 'base64');
    const ledCountBuffer = Buffer.alloc(1);
    ledCountBuffer.writeUInt8(request.led_count, 0);
    const ledValuesBuffer = Buffer.from(request.led_values);
    const message = Buffer.concat([header, authTokenBuffer, ledCountBuffer, ledValuesBuffer]);
    await sendMessage(message, port, address);
}

export async function closeUdpSocket() {
    if (client) {
        const closeAsync = promisify(client.close).bind(client);
        await closeAsync();
        client = null;
        console.log('UDP socket closed.');
    }
}

export interface SetLedValuesRequestSchema {
    authentication_token: string;
    led_count: number;
    led_values: number[];
}
