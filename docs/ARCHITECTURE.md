# Sparkly Architecture

Sparkly is a TypeScript monorepo (npm workspaces) with three packages:

```
packages/
├── common/    # @sparkly/common — Shared API contract and types
├── backend/   # @sparkly/backend — Node.js backend server
└── frontend/  # @sparkly/frontend — SvelteKit web UI
```

## Modules

### @sparkly/common

REST API contract between backend and frontend using [@ts-rest](https://ts-rest.com/):

- API endpoint definitions
- Request/Response schemas (Zod)

Pure TypeScript types and schemas — no browser or Node.js specific code.

### @sparkly/backend

- Communicates with Twinkly devices via their API
- Exposes REST API for frontend (implements the common contract)
- Handles device management, effects, and rendering
- Uses Express, Pino logging, and device-specific UDP communication

### @sparkly/frontend

- Web UI for controlling Twinkly devices
- Consumes the backend API (using the common contract)
- Displays device status, controls brightness/effects

## Module Boundaries

The separation prevents accidental cross-imports:

- ✅ Backend can import from `@sparkly/common`
- ✅ Frontend can import from `@sparkly/common`
- ❌ Backend **cannot** import from frontend
- ❌ Frontend **cannot** import from backend
- ❌ Common **cannot** import from backend or frontend

## Configuration

Device configuration is managed through the web interface. The backend persists device settings to `packages/backend/config.toml` automatically.

## Technology Stack

- **Common**: TypeScript, Zod, @ts-rest
- **Backend**: Node.js, Express, TypeScript, Pino logging
- **Frontend**: SvelteKit, TypeScript, Vite
- **Workspace**: npm workspaces
