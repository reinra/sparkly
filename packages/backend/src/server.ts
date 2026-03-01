import express from 'express';
import cors from 'cors';
import { logger, logError } from './logger';
import { backendApiContract } from '@twinkly-ts/common';
import { registerRoutes } from './TypedHandler';
import { tryToConnectAll } from './DeviceList';
import { apiRoutes } from './ApiRoutes';
import { initializeState } from './StateManager';
import { ensurePortAvailable, listenWithPortCheck } from './utils/ServerUtils';

const PORT = 3001;

// Bail out early if another instance is already running
await ensurePortAvailable(PORT);

const app = express();

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Register all API routes (shared with production server)
registerRoutes(app, backendApiContract, apiRoutes);

listenWithPortCheck(app, PORT, () => {
  initializeState();
  logger.info(`Backend server running on http://localhost:${PORT}`);

  tryToConnectAll().catch((error: unknown) => {
    logError(error).error('Failed to refresh device aliases on startup');
  });
});
