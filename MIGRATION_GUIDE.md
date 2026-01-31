# Migration Guide: Monorepo Structure

## What Changed?

The project has been restructured into a **monorepo** with three separate packages:

### Before
```
src/
├── backend/          # Backend code
├── components/       # Frontend components
├── routes/          # Frontend routes
└── frontendApiClient.ts
```

### After
```
packages/
├── common/          # Shared API contract
│   └── src/
│       ├── backendApiContract.ts
│       ├── types.ts
│       └── index.ts
├── backend/         # Backend server
│   └── src/
│       ├── server.ts
│       ├── deviceClient/
│       ├── effects/
│       └── ...
└── frontend/        # Frontend UI
    └── src/
        ├── components/
        ├── routes/
        └── frontendApiClient.ts
```

## Key Changes

### 1. API Contract (Common Package)

**Old**: `src/backend/backendApiContract.ts`  
**New**: `packages/common/src/backendApiContract.ts`

The API contract is now in a **separate package** that both backend and frontend import.

### 2. Import Changes

#### Backend
```typescript
// OLD
import { backendApiContract } from './backendApiContract';
import { Mode } from './deviceClient/apiContract';

// NEW
import { backendApiContract, Mode } from '@twinkly-ts/common';
```

#### Frontend
```typescript
// OLD
import { backendClient, Mode } from '../frontendApiClient';

// NEW (frontendApiClient is still in frontend package, but imports from common)
import { backendClient, Mode } from './frontendApiClient';
// or directly:
import { Mode } from '@twinkly-ts/common';
```

### 3. Running Commands

```bash
# OLD
npm run dev:server    # Backend
npm run dev:frontend  # Frontend

# NEW (same commands, different implementation)
npm run dev:backend   # Backend
npm run dev:frontend  # Frontend

# Build all packages
npm run build
```

## Benefits of New Structure

### ✅ Clear Module Boundaries
- Backend cannot accidentally import frontend code
- Frontend cannot accidentally import backend code
- Prevents circular dependencies

### ✅ Shared Type Safety
- API contract defined once in `@twinkly-ts/common`
- Both sides use the same types
- Changes to API automatically update both sides

### ✅ Library Compatibility
- Backend can use Node.js-specific libraries without browser issues
- Frontend can use browser APIs without Node.js issues
- No more "Cannot find module 'fs'" errors in frontend builds

### ✅ Independent Deployment
- Backend and frontend can be deployed separately
- Different scaling strategies
- Can use different hosting platforms

## Module Dependencies

```
@twinkly-ts/common (no dependencies on other packages)
        ↑              ↑
        │              │
        │              │
@twinkly-ts/backend   @twinkly-ts/frontend
```

## Development Workflow

### Installing Dependencies
```bash
# Install all packages
npm install
```

This installs dependencies for all three packages using npm workspaces.

### Building

```bash
# Build everything
npm run build

# Or build individually
npm run build:common
npm run build:backend
npm run build:frontend
```

**Note**: Common must be built before backend/frontend if you make changes to it.

### Development

Open two terminals:

```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### VS Code Tasks

Use **Terminal > Run Task** to access:
- Build All
- Build Common
- Build Backend
- Build Frontend
- Dev: Backend
- Dev: Frontend

## Configuration

Backend configuration moved to: `packages/backend/config.toml`

Copy from `packages/backend/config.toml.example`.

## Troubleshooting

### "Cannot find module '@twinkly-ts/common'"

1. Build the common package first:
   ```bash
   npm run build:common
   ```

2. Reinstall if needed:
   ```bash
   rm -rf node_modules packages/*/node_modules
   npm install
   ```

### TypeScript Errors in IDE

1. Restart TypeScript server in VS Code:
   - **Cmd/Ctrl + Shift + P**
   - Type "TypeScript: Restart TS Server"

2. Ensure all packages are built:
   ```bash
   npm run build
   ```

### Import Path Issues

Remember the new import patterns:

- ✅ `import { X } from '@twinkly-ts/common'` (in backend/frontend)
- ✅ `import { Y } from './localFile'` (within same package)
- ❌ `import { Z } from '../../../packages/backend/...'` (cross-package)

## Questions?

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.
