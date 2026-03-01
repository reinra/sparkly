# Sparkly

LED controller for [Twinkly](https://www.twinkly.com/) smart LED devices. Control effects, brightness, and colors through a web interface served from a single executable.

## Download & Run

1. **Download** the latest release from [GitHub Releases](../../releases)
2. **Extract** the zip archive
3. **Run** `sparkly.exe`
4. **Open** your browser to **http://localhost:3001**

No installation or setup required — the executable is fully self-contained.

## Using Sparkly

### Adding Devices

When you first open Sparkly, head to the **Devices** page. You can add your Twinkly devices in two ways:

- **Auto-discover** — Click the discover button to scan your network for Twinkly devices
- **Manual add** — Enter the device's IP address directly

Devices are remembered between sessions automatically.

### Controlling Devices

Each device card on the Devices page lets you:

- **Set mode** — Switch between off, color, effect, and other device modes
- **Adjust brightness** — Slide to set brightness (0–100%)
- **Choose an effect** — Pick from the built-in effect library
- **Tune parameters** — Customize effect colors, speed, and other settings
- **Send movie** — Render an effect and upload it directly to the device hardware

### LED Preview

The web interface can mirror your device's LED state in real time. Two viewing modes are available:

- **Sequential** — LEDs shown in order, ideal for LED strips
- **2D mapped** — LEDs positioned using the device's 2D coordinate mapping

### Debug Page

The **Debug** page provides detailed device information and effect metadata — useful for troubleshooting connection issues.

## Troubleshooting

| Problem                              | Solution                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Windows SmartScreen warning**       | Click **More info**, then click **Run anyway**                                              |
| **"Unknown Publisher" security warning** | Click **Run** to proceed                                                                 |
| **Can't find devices**               | Make sure Twinkly devices are powered on and connected to the same network as your computer |
| **Port 3001 in use**                 | Close any other application using port 3001, then restart Sparkly                           |
| **Frontend won't load**              | Try re-downloading the latest release                                                       |

## Requirements

- Windows (the executable is self-contained, no runtime needed)
- Twinkly LED devices on the same local network

---

# Developer Guide

Everything below is for contributors and developers working on the Sparkly source code.

## Architecture

Sparkly is a TypeScript monorepo (npm workspaces) with three packages:

| Package             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `@sparkly/common`   | Shared API contract and types (Zod + ts-rest)             |
| `@sparkly/backend`  | Express backend — device communication, effects, REST API |
| `@sparkly/frontend` | SvelteKit frontend — web UI                               |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module boundaries and design decisions.

```
packages/
├── common/          # Shared API contract and types
├── backend/         # Express backend server
│   └── src/
│       ├── server.ts          # Development server
│       ├── server-node.ts     # Production server (Node.js)
│       ├── server-bun.ts      # Production server (Bun executable)
│       ├── ApiController.ts   # Route handlers
│       ├── deviceClient/      # Twinkly device protocol
│       ├── effects/           # LED effect library
│       └── render/            # Frame rendering
└── frontend/        # SvelteKit web interface
    └── src/
        ├── routes/            # Pages (devices, debug)
        ├── components/        # Svelte components
        └── FrontendApiClient.ts
scripts/             # Build & distribution scripts
docs/                # Developer documentation
```

## Prerequisites

- Node.js v18+
- npm

## Getting Started

```bash
# Install all dependencies
npm install

# Start backend (http://localhost:3001)
npm run dev:backend

# In another terminal — start frontend (http://localhost:5173)
npm run dev:frontend
```

## Scripts

| Script                         | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `npm run dev:backend`          | Backend with hot reload (port 3001)                    |
| `npm run dev:frontend`         | Frontend with hot reload (port 5173)                   |
| `npm run build`                | Build all packages                                     |
| `npm run build:common`         | Build shared types                                     |
| `npm run build:backend`        | Build backend                                          |
| `npm run build:frontend`       | Build frontend                                         |
| `npm run build:executable`     | Build self-contained Windows executable (requires Bun) |
| `npm run package:distribution` | Build + create distribution zip                        |
| `npm run start:backend`        | Run compiled backend                                   |
| `npm run start:frontend`       | Preview built frontend                                 |

## Building the Executable

```bash
npm run package:distribution
```

Creates a ready-to-distribute package at `dist/sparkly-package/` containing the executable, frontend assets, and documentation. See [docs/BUILD_EXECUTABLE.md](docs/BUILD_EXECUTABLE.md) for details.

## API Reference

The backend REST API runs on port 3001.

**Device Management:**

- `GET /api/info` — Devices and effects list
- `GET /api/system-info` — Build date, version, device modes
- `GET /api/device/discover` — Discover Twinkly devices on the network
- `POST /api/device/add` — Add a device by IP
- `POST /api/device/remove` — Remove a device
- `POST /api/device/reconnect` — Reconnect a device

**Device Control:**

- `POST /api/mode` — Set device mode
- `POST /api/brightness` — Set brightness (0–100)
- `POST /api/effect` — Choose effect
- `POST /api/parameters` — Set effect parameters
- `POST /api/sendMovie` — Render and upload movie to device
- `GET /api/sendMovie/status` — Movie upload progress
- `GET /api/buffer` — Current LED buffer (browser LED mirroring)
- `GET /api/ledMapping` — LED 2D coordinates (browser LED mirroring)

**Effect Management:**

- `POST /api/effect/clone` — Clone an effect
- `POST /api/effect/delete` — Delete an effect
- `POST /api/effect/rename` — Rename an effect
- `POST /api/effect/reset` — Reset effect state

**Debug:**

- `GET /api/hello` — Health check
- `GET /api/debug/device` — Device details
- `GET /api/debug/effects` — All effects with metadata

## Further Documentation

- [Architecture](docs/ARCHITECTURE.md) — Module structure and boundaries
- [Build Executable](docs/BUILD_EXECUTABLE.md) — Building the self-contained executable
- [Validation Guide](docs/VALIDATION_GUIDE.md) — Testing the distribution package
- [Logging](docs/LOGGING.md) — Logger configuration and usage
- [Noise Effects](docs/NOISE_EFFECTS.md) — Using simplex noise in effects
