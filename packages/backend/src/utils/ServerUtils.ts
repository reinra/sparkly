import type { Express } from 'express';
import net from 'net';
import { logger } from '../logger';

/** Delay before process.exit so the user can read the error message
 *  (especially relevant when running as a standalone executable). */
const EXIT_DELAY_MS = 10_000;

/**
 * Log a fatal error, wait so the message is visible, then exit.
 */
function exitWithDelay(message: string): void {
  logger.error(message);
  logger.error(`Exiting in ${EXIT_DELAY_MS / 1000} seconds...`);
  setTimeout(() => process.exit(1), EXIT_DELAY_MS);
}

function portInUseMessage(port: number): string {
  return (
    `Port ${port} is already in use. ` +
    `Another instance of the server may be running. ` +
    `Kill the other process (e.g. "npx kill-port ${port}") and try again.`
  );
}

/**
 * Verify that the given port is free **before** doing any other work.
 *
 * Uses a temporary TCP server to probe the port. If the port is taken
 * the process exits immediately — no state is restored, no devices are
 * contacted, no browser is opened.
 */
export async function ensurePortAvailable(port: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const tester = net.createServer();

    tester.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        exitWithDelay(portInUseMessage(port));
        return;
      }
      // For any other error, still bail out
      exitWithDelay(`Cannot bind port ${port}: ${error.message}`);
    });

    tester.listen(port, () => {
      // Port is free — close the probe and let the caller proceed.
      tester.close(() => resolve());
    });
  });
}

/**
 * Start an Express app on the given port with proper error handling.
 *
 * If the port is already in use, logs a clear error and exits the process
 * instead of silently failing (which would allow two instances to appear
 * to run simultaneously while only the first one actually serves requests).
 */
export function listenWithPortCheck(app: Express, port: number, onListening: () => void): void {
  const server = app.listen(port, onListening);

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      exitWithDelay(portInUseMessage(port));
    }

    // Surface other errors clearly too
    exitWithDelay(`Server error: ${error.message}`);
  });
}
