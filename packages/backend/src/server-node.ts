import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger, logError } from './logger';
import { openBrowser } from './utils/BrowserUtils';
import { backendApiContract } from '@twinkly-ts/common';
import { registerRoutes } from './TypedHandler';
import { tryToConnectAll } from './DeviceList';
import { apiRoutes } from './ApiRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Register all API routes (shared with development server)
registerRoutes(app, backendApiContract, apiRoutes);

// Path to frontend build relative to dist/server-production.js
const frontendPath = path.join(__dirname, '../../frontend/build');

// Validate frontend directory structure before starting
function validateFrontendStructure(): { valid: boolean; error?: string } {
  // Check if frontend build directory exists
  if (!fs.existsSync(frontendPath)) {
    return {
      valid: false,
      error: `Frontend build directory not found: ${frontendPath}. Run "npm run build" first.`,
    };
  }

  // Check if handler.js exists
  const handlerPath = path.join(frontendPath, 'handler.js');
  if (!fs.existsSync(handlerPath)) {
    return {
      valid: false,
      error: `SvelteKit handler not found: ${handlerPath}. The frontend build may be incomplete.`,
    };
  }

  return { valid: true };
}

// Serve static assets from client directory first
const clientPath = path.join(frontendPath, 'client');
app.use(express.static(clientPath));

// Initialize and start server with SvelteKit handler
async function startServer() {
  // Validate directory structure
  const validation = validateFrontendStructure();
  if (!validation.valid) {
    logger.error(`Frontend validation failed: ${validation.error}`);
    logger.error(`Expected frontend path: ${frontendPath}`);
    process.exit(1);
  }

  try {
    // Import the SvelteKit handler
    const handlerPath = path.join(frontendPath, 'handler.js');
    logger.info(`Loading SvelteKit handler from: ${handlerPath}`);

    // Convert to file:// URL for proper ESM import
    const handlerUrl = `file://${handlerPath.replace(/\\/g, '/')}`;

    const handlerModule = await import(handlerUrl);
    const handler = handlerModule.handler;

    if (!handler) {
      throw new Error('SvelteKit handler not found in module');
    }

    // Use the SvelteKit handler for all remaining routes
    app.use(handler);

    logger.info('SvelteKit frontend loaded successfully');
  } catch (error) {
    logger.withError(error as Error).error('Failed to load SvelteKit handler');
    process.exit(1);
  }

  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    logger.info(`Production server running on ${url}`);
    logger.info(`Serving frontend from: ${frontendPath}`);
    logger.info(`Opening browser automatically...`);

    // Open browser after a short delay to ensure server is ready
    setTimeout(() => openBrowser(url), 1000);

    tryToConnectAll().catch((error: unknown) => {
      logError(error).error('Failed to refresh device aliases on startup');
    });
  });
}

// Start the server
startServer().catch((error) => {
  logger.withError(error as Error).error('Failed to start server');
  process.exit(1);
});
