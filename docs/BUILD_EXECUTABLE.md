# Building the Executable

The production build combines backend and frontend into a single executable that runs on Windows without Node.js.

## Prerequisites

### Bun (Recommended)

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
bun --version
```

Or download from https://bun.sh.

### Alternative: Node.js pkg

```bash
npm install -g pkg
```

## Build & Package

```bash
# Build executable + create distribution package
npm run package:distribution
```

This creates `dist/sparkly-package/` with the executable and a README, ready to zip and distribute.

To build only the executable (without packaging):

```bash
npm run build:executable
```

Output: `dist/sparkly.exe`

### Using pkg instead of Bun

```bash
npm run build
pkg packages/backend/dist/server-node.js --target node20-win-x64 --output dist/sparkly.exe --compress GZip
```

## Production Testing

Test the production server without building an executable:

```bash
npm run build
node packages/backend/dist/server-node.js
```

## Cross-Platform Building

**Bun:**

```bash
bun build packages/backend/dist/server-bun.js --compile --target=bun-windows-x64 --outfile dist/sparkly-win.exe
bun build packages/backend/dist/server-bun.js --compile --target=bun-linux-x64 --outfile dist/sparkly-linux
bun build packages/backend/dist/server-bun.js --compile --target=bun-darwin-x64 --outfile dist/sparkly-mac
```

**pkg:**

```bash
pkg packages/backend/dist/server-node.js --targets node20-win-x64,node20-linux-x64,node20-macos-x64 --out-path dist
```

## Troubleshooting

| Problem                | Solution                                   |
| ---------------------- | ------------------------------------------ |
| "Bun is not installed" | Install Bun (see Prerequisites) or use pkg |
| "Frontend not built"   | Run `npm run build` first                  |
| Port 3001 in use       | Stop the conflicting process               |
| Frontend not loading   | Rebuild with `npm run build:executable`    |

## Size

- **Bun**: ~100–150 MB (includes Bun runtime)
- **pkg**: ~50–80 MB (includes Node.js runtime)
