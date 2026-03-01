# Building Self-Contained Executable for Sparkly

This guide explains how to build a self-contained executable for your Sparkly application.

## Overview

The production build combines your backend server and frontend web interface into a single executable file that can be run on Windows without requiring Node.js or npm to be installed.

## Prerequisites

You have two options for building the executable:

### Option 1: Using Bun (Recommended)

1. **Install Bun** (if not already installed):

   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

   Or download from: https://bun.sh

2. **Verify Bun installation**:
   ```powershell
   bun --version
   ```

### Option 2: Using Node.js with pkg

1. **Install pkg globally**:
   ```bash
   npm install -g pkg
   ```

## Building the Executable

### With Bun (Recommended - Smaller Size & Faster)

1. **Build all packages and create executable**:

   ```bash
   npm run build:executable
   ```

   This will:
   - Compile TypeScript code for all packages
   - Build the frontend as static files
   - Create a self-contained executable at `dist/sparkly.exe`

2. **Output location**: `dist/sparkly.exe`

### With Node.js pkg (Alternative)

If you prefer to use Node.js pkg instead of Bun, follow these steps:

1. **Install pkg**:

   ```bash
   npm install -g pkg
   ```

2. **Build all packages**:

   ```bash
   npm run build
   ```

3. **Create the executable**:
   ```bash
   pkg packages/backend/dist/server-node.js --target node20-win-x64 --output dist/sparkly.exe --compress GZip
   ```

## Distribution

The Bun executable embeds the frontend assets, so the distribution is a single file:

1. **The executable**: `dist/sparkly.exe`

Run `npm run package:distribution` to create a ready-to-ship package at `dist/sparkly-package/` containing the executable and a README.

## Running the Executable

1. Run the executable:
   ```powershell
   ./sparkly.exe
   ```
2. Access the web interface at `http://localhost:3001`

## Development Mode (Unchanged)

Development mode remains unchanged and continues to work as before:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

## Production Testing

Before building the executable, you can test the production setup:

1. **Build all packages**:

   ```bash
   npm run build
   ```

2. **Run production server** (without executable):

   ```bash
   npm run start:production --workspace=@sparkly/backend
   ```

   Or directly:

   ```bash
   node packages/backend/dist/server-node.js
   ```

## File Changes Summary

### New Files

- `packages/backend/src/server-node.ts` - Production server for Node.js that serves both API and static frontend
- `packages/backend/src/server-bun.ts` - Production server for Bun executable
- `scripts/build-executable.js` - Build script for creating the executable
- `EXECUTABLE_README.md` - User documentation for the executable

### Modified Files

- `package.json` - Added `build:executable` script
- `packages/backend/package.json` - Added `start:production` script

## Troubleshooting

### "Bun is not installed"

Install Bun using the command in the Prerequisites section, or use the pkg alternative method.

### "Frontend not built"

Run `npm run build` before `npm run build:executable`.

### "Port 3001 already in use"

Stop any other services using port 3001, or modify `packages/backend/src/server-node.ts` to use a different port.

### Frontend not loading

The frontend is embedded in the Bun executable. If it fails to load, rebuild with `npm run build:executable`.

## Size Considerations

- **Bun executable**: ~100-150 MB (includes Bun runtime, your code, and dependencies)
- **pkg executable**: ~50-80 MB (includes Node.js runtime and your code)

Both methods produce a fully self-contained executable with no external dependencies.

## Security Notes

- The executable includes all source code (though minified)
- Device configuration (`config.toml`) is managed via the web interface and persisted at runtime
- Sensitive information should not be hardcoded

## Cross-Platform Building

To build for different platforms:

**With Bun:**

```bash
bun build packages/backend/dist/server-bun.js --compile --target=bun-windows-x64 --outfile dist/sparkly-win.exe
bun build packages/backend/dist/server-bun.js --compile --target=bun-linux-x64 --outfile dist/sparkly-linux
bun build packages/backend/dist/server-bun.js --compile --target=bun-darwin-x64 --outfile dist/sparkly-mac
```

**With pkg:**

```bash
pkg packages/backend/dist/server-node.js --targets node20-win-x64,node20-linux-x64,node20-macos-x64 --out-path dist
```
