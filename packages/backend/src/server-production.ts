import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, logError } from './logger';
import { backendApiContract } from '@twinkly-ts/common';
import { registerRoutes } from './typedHandler';
import { tryToConnectAll } from './deviceList';
import { apiRoutes } from './apiRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running in Bun bundled executable
const isBundledExecutable = typeof process !== 'undefined' && 
  (process.execPath?.includes('twinkly-server') || process.argv[0]?.includes('twinkly-server'));

// Get the executable's directory when bundled
function getExecutableDirectory(): string {
  if (isBundledExecutable) {
    // Get the directory containing the executable
    return path.dirname(process.execPath);
  }
  return __dirname;
}

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Register all API routes (shared with development server)
registerRoutes(app, backendApiContract, apiRoutes);

// Serve SvelteKit frontend
const executableDir = getExecutableDirectory();
const frontendPath = isBundledExecutable
  ? path.join(executableDir, 'packages', 'frontend', 'build')
  : path.join(__dirname, '../../frontend/build');

// Validate frontend directory structure before starting
function validateFrontendStructure(): { valid: boolean; error?: string } {
  const fs = require('fs');
  
  // Check if packages directory exists
  const packagesDir = path.join(executableDir, 'packages');
  if (isBundledExecutable && !fs.existsSync(packagesDir)) {
    return {
      valid: false,
      error: `Missing 'packages' directory. The executable must be run from the distribution package directory that contains the 'packages' folder. Expected: ${packagesDir}`
    };
  }
  
  // Check if frontend build directory exists
  if (!fs.existsSync(frontendPath)) {
    return {
      valid: false,
      error: `Frontend build directory not found: ${frontendPath}. Ensure the distribution package is complete.`
    };
  }
  
  // Check if handler.js exists
  const handlerPath = path.join(frontendPath, 'handler.js');
  if (!fs.existsSync(handlerPath)) {
    return {
      valid: false,
      error: `SvelteKit handler not found: ${handlerPath}. The frontend build may be incomplete.`
    };
  }
  
  // Check if server directory exists (contains handler dependencies)
  const serverDir = path.join(frontendPath, 'server');
  if (!fs.existsSync(serverDir)) {
    return {
      valid: false,
      error: `Frontend server directory not found: ${serverDir}. The frontend build may be incomplete.`
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
    logger.error(`Executable location: ${process.execPath}`);
    logger.error(`Working directory: ${process.cwd()}`);
    logger.error(`Expected frontend path: ${frontendPath}`);
    
    // Install error handler for all routes
    app.use((req, res) => {
      res.status(500).json({ 
        error: 'Frontend failed to load - Invalid directory structure',
        details: validation.error,
        path: req.path,
        executableLocation: process.execPath,
        expectedFrontendPath: frontendPath
      });
    });
    
    // Start server anyway so users can see the error message
    app.listen(PORT, () => {
      logger.error(`Server started with frontend disabled due to validation errors`);
      logger.error(`Please ensure the executable is in the correct directory`);
    });
    return;
  }
  
  try {
    // Import the SvelteKit handler
    const handlerPath = path.join(frontendPath, 'handler.js');
    logger.info(`Loading SvelteKit handler from: ${handlerPath}`);
    
    // For bundled executables, we need to ensure the module can find its dependencies
    // Set NODE_PATH to include the server directory so relative imports work
    if (isBundledExecutable) {
      const serverDir = path.join(frontendPath, 'server');
      process.env.NODE_PATH = serverDir + path.delimiter + (process.env.NODE_PATH || '');
      require('module').Module._initPaths();
    }
    
    // Convert to file:// URL for proper ESM import in bundled context
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
    
    // Fallback error handler
    app.use((req, res) => {
      res.status(500).json({ 
        error: 'Frontend failed to load', 
        path: req.path,
        details: (error as Error).message 
      });
    });
  }

  app.listen(PORT, () => {
    logger.info(`Production server running on http://localhost:${PORT}`);
    logger.info(`Serving frontend from: ${frontendPath}`);

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
