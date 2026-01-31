# twinkly-ts

A Twinkly LED controller with TypeScript backend and SvelteKit frontend.

> **Note**: This project now uses a modular architecture with separate packages for common types, backend, and frontend. See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

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

- `npm run dev:server` - Start the Express backend API server on port 3001
- `npm run dev:frontend` - Start the SvelteKit frontend on port 5173
- `npm run build` - Build the TypeScript backend
- `npm run build:frontend` - Build the SvelteKit frontend
- `npm start:server` - Run the compiled backend server

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
