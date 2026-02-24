import express from 'express';
import cors from 'cors';
import { logger, logError } from './logger';
import { backendApiContract } from '@twinkly-ts/common';
import { registerRoutes } from './TypedHandler';
import { tryToConnectAll } from './DeviceList';
import { apiRoutes } from './ApiRoutes';

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Register all API routes (shared with production server)
registerRoutes(app, backendApiContract, apiRoutes);

app.listen(PORT, () => {
  logger.info(`Backend server running on http://localhost:${PORT}`);

  tryToConnectAll().catch((error: unknown) => {
    logError(error).error('Failed to refresh device aliases on startup');
  });
});
