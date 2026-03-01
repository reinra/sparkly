# Twinkly-TS Executable Distribution

This is a self-contained executable build of the Twinkly-TS server.

## What's Included

This executable bundles:
- Backend API server
- Frontend web interface (SvelteKit SSR)
- All dependencies

## Requirements

- Windows operating system
- No Node.js installation required - fully self-contained
- `config.toml` file (configuration for your Twinkly devices)

## Important: Directory Structure

**⚠️ The executable must remain in its distribution package directory structure:**

```
twinkly-server-package/
├── twinkly-server.exe       ← Executable must stay here
├── packages/
│   └── frontend/
│       └── build/           ← Frontend files must be in this location
├── config.toml              ← Your configuration
└── start.bat                ← Optional launcher script
```

**Do not move the executable outside of this directory!** The executable uses its own location to find the frontend files in the `packages/` directory relative to itself.

You can run the executable from any working directory using an absolute or relative path, but the executable file must physically remain in the directory that contains the `packages/` folder.

## Setup

1. **Create a configuration file** named `config.toml` in the same directory as the executable.

   Example `config.toml`:
   ```toml
   [[devices]]
   id = "device1"
   alias = "Tree"
   ip = "192.168.1.100"
   ```

2. **Run the executable**:
   
   Option A - From within the package directory:
   ```bash
   cd twinkly-server-package
   .\twinkly-server.exe
   ```
   
   Option B - From any other directory:
   ```bash
   .\path\to\twinkly-server-package\twinkly-server.exe
   ```
   
   Option C - Use the provided batch file:
   ```bash
   start.bat
   ```

3. **Access the web interface**:
   Open your browser and navigate to `http://localhost:3001`

## Configuration

The `config.toml` file should contain your Twinkly device configurations. You can find an example in the source repository at `packages/backend/config.toml.example`.

### Example Configuration

```toml
[[devices]]
id = "living_room"
alias = "Living Room Tree"
ip = "192.168.1.50"

[[devices]]
id = "bedroom"
alias = "Bedroom Lights"
ip = "192.168.1.51"
```

## Troubleshooting

### "Frontend failed to load" Error

If you see an error like `{"error":"Frontend failed to load - Invalid directory structure"}`, this means the executable cannot find the frontend files.

**Solution:** Ensure the executable is in the correct directory structure:
- The executable must be in the same folder as the `packages/` directory
- Do NOT move the executable to a different location
- The error message will show you the expected paths

Example error output:
```json
{
  "error": "Frontend failed to load - Invalid directory structure",
  "details": "Missing 'packages' directory...",
  "executableLocation": "F:\\path\\to\\twinkly-server.exe",
  "expectedFrontendPath": "F:\\path\\to\\packages\\frontend\\build"
}
```

### Port Already in Use
If port 3001 is already in use, you'll need to stop the conflicting application or modify the source code to use a different port and rebuild the executable.

### Configuration Not Found
Make sure `config.toml` is in the same directory as the executable. The server will look for it in the executable's directory (not the current working directory when bundled).

### Device Connection Issues
- Verify your device IPs are correct
- Ensure devices are on the same network as the server
- Check that devices are powered on and accessible

## Technical Details

### Path Resolution
The executable uses `path.dirname(process.execPath)` to resolve file paths, which means:
- Frontend files are loaded relative to the executable's location
- You can run the executable from any working directory
- The executable itself must remain in the distribution package directory

### Validation
On startup, the executable validates:
- `packages/` directory exists next to the executable
- `packages/frontend/build/` directory exists
- `handler.js` and `server/` directory are present
- Clear error messages if validation fails

## Logs

The server outputs logs to the console. Check for any error messages that might indicate configuration or connection issues.

## Building from Source

To build this executable yourself:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build all packages: `npm run build`
4. Build executable: `npm run build:executable`

The executable will be created in the `dist/` directory.
