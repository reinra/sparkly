import { exec } from 'child_process';
import { logger } from '../logger';

/**
 * Opens a URL in the default browser
 */
export function openBrowser(url: string): void {
  const command = process.platform === 'win32'
    ? `start ${url}`
    : process.platform === 'darwin'
    ? `open ${url}`
    : `xdg-open ${url}`;
  
  exec(command, (error) => {
    if (error) {
      logger.withError(error).warn('Failed to open browser automatically');
    }
  });
}
