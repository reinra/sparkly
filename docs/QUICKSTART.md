# Developer Quick Start

> This guide is for **developers** working on the Sparkly source code. If you just want to run Sparkly, download the latest release from GitHub and run `sparkly.exe` — see the main [README](../README.md).

## Running in Development Mode

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Backend

```bash
npm run dev:backend
```

Backend API starts on **http://localhost:3001**.

### 3. Start the Frontend

In a second terminal:

```bash
npm run dev:frontend
```

Frontend dev server starts on **http://localhost:5173**.

## Testing the API

You can also test the backend API directly:

```bash
# Test hello endpoint
curl http://localhost:3001/api/hello

# Get devices and effects info
curl http://localhost:3001/api/info
```

## Troubleshooting

### Backend Connection Error

If the frontend shows "Failed to connect to backend":

1. Make sure the backend server is running on port 3001
2. Check that there are no firewall issues blocking the connection

### Device Status Error

If you get "Failed to get device status":

1. Make sure your Twinkly device is powered on and connected to the network
2. Verify you can ping the device from your computer
3. Add devices via the web interface if not already added

### Port Already in Use

If port 3001 or 5173 is already in use, you can:

- Stop the process using that port
- Or modify the port in [packages/backend/src/server.ts](../packages/backend/src/server.ts) (backend) or [packages/frontend/vite.config.mjs](../packages/frontend/vite.config.mjs) (frontend)
