# Sparkly Modular Architecture

This project has been restructured into a monorepo with three clear modules:

## 📦 Project Structure

```
sparkly/
├── packages/
│   ├── common/          # Shared API contract and types
│   ├── backend/         # Node.js backend server
│   └── frontend/        # Svelte frontend UI
└── package.json         # Root workspace configuration
```

## 🏗️ Module Descriptions

### 1. **@sparkly/common**

Contains the REST API contract between backend and frontend using [@ts-rest](https://ts-rest.com/):

- API endpoint definitions
- Request/Response schemas (Zod)

**No browser or Node.js specific code** - pure TypeScript types and schemas.

### 2. **@sparkly/backend**

Node.js backend server that:

- Communicates with Twinkly devices via their API
- Exposes REST API for frontend (implements the common contract)
- Handles device management, effects, and rendering
- Uses Express, Pino logging, and device-specific UDP communication

Can use Node.js-specific libraries without browser compatibility issues.

### 3. **@sparkly/frontend**

SvelteKit frontend that:

- Provides web UI for controlling Twinkly devices
- Consumes the backend API (using the common contract)
- Displays device status, controls brightness/effects

Can use browser APIs without Node.js compatibility issues.

## 🚀 Getting Started

### Installation

```bash
# Install all dependencies
npm install
```

This will install dependencies for all three packages.

### Development

Run backend and frontend separately in development mode:

```bash
# Terminal 1: Start backend server (runs on http://localhost:3001)
npm run dev:backend

# Terminal 2: Start frontend dev server (runs on http://localhost:5173)
npm run dev:frontend
```

### Building

```bash
# Build all packages
npm run build

# Or build individually
npm run build:common
npm run build:backend
npm run build:frontend
```

### Production

```bash
# Start backend (after building)
npm run start:backend

# Preview frontend build
npm run start:frontend
```

## 📂 Configuration

Device configuration is managed through the web interface. The backend persists device settings to `packages/backend/config.toml` automatically.

## 🔒 Module Boundaries

The separation prevents accidental cross-imports:

- ✅ Backend can import from `@sparkly/common`
- ✅ Frontend can import from `@sparkly/common`
- ❌ Backend **cannot** import from frontend
- ❌ Frontend **cannot** import from backend
- ❌ Common **cannot** import from backend or frontend

This ensures:

- Clean architecture
- No circular dependencies
- Type safety across API boundaries
- Independent deployment of frontend/backend

## 🛠️ Key Benefits

1. **Clear Separation**: Frontend and backend code cannot accidentally reference each other
2. **Shared Contract**: API types are defined once and shared via `@sparkly/common`
3. **Type Safety**: Full TypeScript support across the entire API surface
4. **Independent Development**: Frontend and backend can be developed/deployed separately
5. **Library Compatibility**: Use Node.js libraries in backend and browser APIs in frontend without conflicts

## 📚 Technology Stack

- **Common**: TypeScript, Zod, @ts-rest
- **Backend**: Node.js, Express, TypeScript, Pino logging
- **Frontend**: SvelteKit, TypeScript, Vite
- **Workspace**: npm workspaces
