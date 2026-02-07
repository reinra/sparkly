import pino from 'pino';
import { LogLayer } from 'loglayer';
import { PinoTransport } from '@loglayer/transport-pino';
import { Writable } from 'stream';

// Detect if running in Bun bundled executable
// Bun sets process.isBun and executable has different characteristics
const isBundledExecutable = typeof process !== 'undefined' && 
  (process.execPath?.includes('twinkly-server') || process.argv[0]?.includes('twinkly-server'));

// Custom stream for human-friendly production logging
class HumanFriendlyStream extends Writable {
  _write(chunk: any, encoding: string, callback: () => void) {
    try {
      const log = JSON.parse(chunk.toString());
      
      // Format timestamp
      const timestamp = new Date(log.time).toLocaleString('sv-SE').replace('T', ' ');
      
      // Map level number to name
      const levelMap: Record<number, string> = {
        10: 'TRACE',
        20: 'DEBUG',
        30: 'INFO',
        40: 'WARN',
        50: 'ERROR',
        60: 'FATAL',
      };
      const level = levelMap[log.level] || 'INFO';
      
      // Build log line: [timestamp] LEVEL: message
      let logLine = `[${timestamp}] ${level}: ${log.msg || ''}`;
      
      // Add extra properties (excluding internal pino fields)
      const excludeKeys = ['level', 'time', 'pid', 'hostname', 'msg'];
      const extras = Object.keys(log)
        .filter(key => !excludeKeys.includes(key))
        .map(key => {
          const value = log[key];
          // Format objects/arrays nicely
          if (typeof value === 'object') {
            return `${key}=${JSON.stringify(value)}`;
          }
          return `${key}=${value}`;
        })
        .join(' ');
      
      if (extras) {
        logLine += ` ${extras}`;
      }
      
      process.stdout.write(logLine + '\n');
    } catch (err) {
      // Fallback to raw output if JSON parsing fails
      process.stdout.write(chunk.toString());
    }
    callback();
  }
}

// Create Pino instance with pretty printing for development
// In production/bundled mode, use custom formatter for human-friendly output
// Set LOG_LEVEL environment variable to control log level (trace, debug, info, warn, error, fatal)
// Example: LOG_LEVEL=debug npm run dev:server
const pinoInstance = isBundledExecutable
  ? pino(
      { level: process.env.LOG_LEVEL || 'info' },
      new HumanFriendlyStream()
    )
  : pino({
      level: process.env.LOG_LEVEL || 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    });

// Helper function to ensure we have an Error object
// Converts unknown values to Error objects if needed
function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  // Convert non-Error values to Error objects
  return new Error(String(error));
}

// Export LogLayer instance directly
// LogLayer provides a unified logging interface with methods like:
// - logger.info(message) or logger.withMetadata({...}).info(message)
// - logger.withError(error).error(message) for errors
// - logger.withContext({...}) for persistent context across logs
export const logger = new LogLayer({
  transport: new PinoTransport({
    logger: pinoInstance,
  }),
});

// Export a helper to log errors without casting
export const logError = (error: unknown) => logger.withError(ensureError(error));

// Export a helper to add metadata without casting
export const withMeta = (metadata: Record<string, unknown>) => logger.withMetadata(metadata as any);
