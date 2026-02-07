import express from 'express';
import cors from 'cors';
import { logger, logError } from './logger';
import { backendApiContract } from '@twinkly-ts/common';
import { registerRoutes } from './typedHandler';
import { tryToConnectAll } from './deviceList';
import { apiRoutes } from './apiRoutes';
import { openBrowser } from './utils/browserUtils';

// @ts-ignore
import { handler } from '../../frontend/build/handler.js';
// @ts-ignore
import { assets } from './generated/assets';

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Register all API routes
registerRoutes(app, backendApiContract, apiRoutes);

// Serve Static Assets from Embedded Bun Bundle
app.use(async (req, res, next) => {
  const url = req.path;
  const assetPath = assets[url];

  if (assetPath) {
    try {
      const file = Bun.file(assetPath);
      
      // Handle MIME Types
      if (file.type) {
        res.type(file.type);
      } else if (url.endsWith('.css')) {
        res.type('text/css');
      } else if (url.endsWith('.js')) {
        res.type('application/javascript');
      } else if (url.endsWith('.html')) {
        res.type('text/html');
      }

      const content = await file.arrayBuffer();
      res.send(Buffer.from(content));
      return;
    } catch (e) {
      logger.error(`Failed to serve asset: ${url}`, e);
      // Continue to next middleware
    }
  }
  next();
});

// Register SvelteKit Handler
// The handler will take care of SSR and other routes
app.use(handler);

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  logger.info(`Bundled server running on ${url}`);
  logger.info(`Embedded assets loaded: ${Object.keys(assets).length} files`);
  
  // Open browser after a short delay
  setTimeout(() => openBrowser(url), 1000);

  tryToConnectAll().catch((error: unknown) => {
    logError(error).error('Failed to refresh device aliases on startup');
  });
});
