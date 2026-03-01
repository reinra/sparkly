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

### Configuration

1. Copy `packages/backend/config.toml.example` to `packages/backend/config.toml`
2. Update the IP address of your Twinkly device in `config.toml`

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
- Configuration template
- User documentation

See [BUILD_EXECUTABLE.md](docs/BUILD_EXECUTABLE.md) for detailed instructions and [SETUP_COMPLETE.md](docs/SETUP_COMPLETE.md) for the complete setup guide.

## Project Structure

- `src/` - Backend TypeScript source files
  - `server.ts` - Express API server
  - `index.ts` - Original CLI application
  - `apiClient.ts` - Twinkly API client
  - `effects/` - LED effect implementations
  - `routes/` - SvelteKit frontend pages
  - `app.html` - HTML template for frontend
  - `app.d.ts` - TypeScript declarations for frontend
- `dist/` - Compiled JavaScript files (generated after build)
- `svelte.config.js` - SvelteKit configuration
- `vite.config.mjs` - Vite build configuration

## API Endpoints

- `GET /api/hello` - Simple hello world endpoint
- `GET /api/status` - Get Twinkly device status
- `POST /api/mode` - Set device mode
