## Project: sparkly

LED controller for Twinkly devices.

### Architecture

TypeScript monorepo using npm workspaces with three packages:

- **@sparkly/common** — Shared API contract and types (ts-rest, Zod). No browser or Node.js specific code.
- **@sparkly/backend** — Node.js server (Express, Pino logging, UDP device communication). Implements the common contract.
- **@sparkly/frontend** — SvelteKit web UI (Svelte 5, Vite). Consumes the backend API via the common contract.

#### Module boundaries

- Backend and frontend can import from `@sparkly/common`
- Backend and frontend **cannot** import from each other
- Common **cannot** import from backend or frontend

### Important Guidelines

**Always verify compilation after changes:** After making any code changes, always run `npm run build` to ensure the project compiles successfully. Do not leave the codebase in a broken state.

**Backend-driven UI:** The frontend must not hardcode static metadata such as category labels, option lists, or display order. Instead, define these constants in the backend and expose them via the `getSystemInfo` endpoint (see `DeviceModes` as the reference pattern). The frontend fetches this data on startup and stores it in `DeviceStore` for use throughout the UI.

**Formatting:** The project uses Prettier with Husky + lint-staged. Code is auto-formatted on commit. Do not add manual formatting changes.

### Build & Run

**Prerequisites:** Node.js and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build all packages (common must build first — the build script handles ordering):

   ```bash
   npm run build
   ```

3. Run in development mode (backend and frontend are separate):

   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

4. Start in production mode:

   ```bash
   npm run start:backend
   npm run start:frontend
   ```

You can also use VS Code tasks (Terminal > Run Task) to build or run individual packages.

### Documentation

See the `docs/` folder for detailed guides: architecture, logging, effects, validation, and executable build instructions.
