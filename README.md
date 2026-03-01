# twinkly-ts

A Twinkly LED controller with TypeScript backend and SvelteKit frontend.

> **Note**: This project now uses a modular architecture with separate packages for common types, backend, and frontend. See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- A Twinkly LED device on your network

### Installation

Install dependencies for all packages:

```bash
npm install
```

### Running the Project

#### Development Mode

In one terminal, start the backend server:

```bash
npm run dev:backend
```

In another terminal, start the frontend:

```bash
npm run dev:frontend
```

Then open your browser to http://localhost:5173

### Available Scripts

**Development:**

- `npm run dev:backend` - Start the Express backend API server on port 3001 with hot reload
- `npm run dev:frontend` - Start the SvelteKit frontend on port 5173 with hot reload

**Building:**

- `npm run build` - Build all packages (common, backend, frontend)
- `npm run build:common` - Build shared types package
- `npm run build:backend` - Build TypeScript backend
- `npm run build:frontend` - Build SvelteKit frontend

**Production:**

- `npm run build:executable` - Build self-contained Windows executable (requires Bun)
- `npm run package:distribution` - Create complete distribution package ready to deploy

**Testing:**

- `npm run start:backend` - Run the compiled backend server
- `npm run start:frontend` - Preview the built frontend

## Distribution

This project can be built as a **self-contained executable** that runs on any Windows machine **without requiring Node.js**:

```bash
npm run package:distribution
```

This creates a complete distribution package at `dist/twinkly-server-package/` with:

- Self-contained executable (~110 MB, includes Bun runtime)
- Frontend web interface
- User documentation

See [BUILD_EXECUTABLE.md](docs/BUILD_EXECUTABLE.md) for detailed build instructions.

## Project Structure

This project uses a monorepo (npm workspaces) with three packages:

```
packages/
├── common/          # Shared API contract and types (@twinkly-ts/common)
│   └── src/
│       ├── BackendApiContract.ts
│       ├── types.ts
│       └── index.ts
├── backend/         # Express backend server (@twinkly-ts/backend)
│   └── src/
│       ├── server.ts          # Development Express server
│       ├── server-node.ts     # Production server (Node.js)
│       ├── server-bun.ts      # Production server (Bun executable)
│       ├── ApiController.ts   # API route handlers
│       ├── deviceClient/      # Twinkly device communication
│       ├── effects/           # LED effect implementations
│       └── ...
└── frontend/        # SvelteKit frontend (@twinkly-ts/frontend)
    └── src/
        ├── routes/            # SvelteKit pages
        ├── components/        # Svelte components
        ├── FrontendApiClient.ts
        └── app.html
scripts/             # Build & distribution scripts
docs/                # Documentation
```

## API Endpoints

The backend exposes a REST API on port 3001. Key endpoints include:

**Device Management:**

- `GET /api/info` - Get devices and effects list
- `GET /api/system-info` - Build date, version, device modes
- `GET /api/device/discover` - Discover Twinkly devices on the network
- `POST /api/device/add` - Add a device by IP
- `POST /api/device/remove` - Remove a device
- `POST /api/device/reconnect` - Reconnect a device

**Device Control:**

- `POST /api/mode` - Set device mode
- `POST /api/brightness` - Set brightness (0-100)
- `POST /api/effect` - Choose effect for a device
- `POST /api/parameters` - Set effect parameters
- `POST /api/sendMovie` - Render and upload movie to device
- `GET /api/sendMovie/status` - Get movie upload progress
- `GET /api/buffer` - Current LED buffer (used for browser LED mirroring)
- `GET /api/ledMapping` - LED 2D coordinates (used for browser LED mirroring)

**Effect Management:**

- `POST /api/effect/clone` - Clone an effect
- `POST /api/effect/delete` - Delete an effect
- `POST /api/effect/rename` - Rename an effect
- `POST /api/effect/reset` - Reset effect state

**Debug:**

- `GET /api/hello` - Health check
- `GET /api/debug/device` - Debug device details
- `GET /api/debug/effects` - All effects with metadata
