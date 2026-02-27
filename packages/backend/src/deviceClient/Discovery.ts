import dgram from 'dgram';
import { logger } from '../logger';

const DISCOVERY_PORT = 5555;
const DISCOVERY_TIMEOUT_MS = 3000;

/** Raw result from UDP discovery before gestalt enrichment. */
export interface DiscoveryRawResult {
  ip: string;
  deviceId: string;
}

/**
 * Build the 9-byte discovery request datagram.
 * Byte 0: 0x01 (version), Bytes 1-8: ASCII "discover"
 */
function buildDiscoveryMessage(): Buffer {
  const version = Buffer.from([0x01]);
  const discover = Buffer.from('discover', 'ascii');
  return Buffer.concat([version, discover]);
}

/**
 * Parse a discovery response datagram.
 *
 * Format:
 *   bytes[0..3] — IP octets in reverse order (byte 0 = last octet)
 *   bytes[4..5] — 0x79 0x75 ("OK")
 *   bytes[6..n-1] — device ID string (ASCII)
 *   byte[n] — 0x00 null terminator
 */
function parseDiscoveryResponse(msg: Buffer, senderIp: string): DiscoveryRawResult | null {
  const hex = msg.toString('hex');

  // Minimum: 4 (IP) + 2 (OK) + 1 (device ID) + 1 (null) = 8
  if (msg.length < 8) {
    logger.debug(`Discovery response from ${senderIp} too short (${msg.length} bytes), hex: ${hex}, ignoring`);
    return null;
  }

  // Validate OK marker (ASCII "OK" = 0x4F 0x4B)
  if (msg[4] !== 0x4f || msg[5] !== 0x4b) {
    logger.debug(
      `Discovery response from ${senderIp} missing OK marker (bytes 4-5: 0x${msg[4]?.toString(16)} 0x${msg[5]?.toString(16)}), hex: ${hex}, ignoring`
    );
    return null;
  }

  // IP: bytes are in reverse order — byte 0 is last octet
  const ip = `${msg[3]}.${msg[2]}.${msg[1]}.${msg[0]}`;

  // Device ID: from byte 6 up to (but not including) trailing null
  let end = msg.length;
  if (msg[msg.length - 1] === 0x00) {
    end = msg.length - 1;
  }
  const deviceId = msg.subarray(6, end).toString('ascii');

  return { ip, deviceId };
}

/**
 * Broadcast a Twinkly discovery request on the local network and collect
 * all responses within a timeout window.
 *
 * Returns deduplicated results (by IP).
 */
export function discoverDevicesOnNetwork(timeoutMs: number = DISCOVERY_TIMEOUT_MS): Promise<DiscoveryRawResult[]> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, DiscoveryRawResult>();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    const cleanup = () => {
      try {
        socket.close();
      } catch {
        // already closed
      }
    };

    socket.on('error', (err) => {
      logger.error(`Discovery socket error: ${err.message}`);
      cleanup();
      reject(err);
    });

    socket.on('message', (msg, rinfo) => {
      const result = parseDiscoveryResponse(msg, rinfo.address);
      if (result && !results.has(result.ip)) {
        results.set(result.ip, result);
        logger.debug(`Discovered device at ${result.ip} (id: ${result.deviceId})`);
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      const message = buildDiscoveryMessage();

      socket.send(message, 0, message.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
        if (err) {
          logger.error(`Failed to send discovery broadcast: ${err.message}`);
          cleanup();
          reject(err);
          return;
        }
        logger.debug('Discovery broadcast sent');
      });

      // Collect responses for the timeout duration, then resolve
      setTimeout(() => {
        cleanup();
        const found = Array.from(results.values());
        logger.info(`Discovery complete: found ${found.length} device(s)`);
        resolve(found);
      }, timeoutMs);
    });
  });
}
