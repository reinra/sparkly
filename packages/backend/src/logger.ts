import pino from 'pino';
import { LogLayer } from 'loglayer';
import { PinoTransport } from '@loglayer/transport-pino';

// Create Pino instance with pretty printing for development
// Set LOG_LEVEL environment variable to control log level (trace, debug, info, warn, error, fatal)
// Example: LOG_LEVEL=debug npm run dev:server
const pinoInstance = pino({
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
