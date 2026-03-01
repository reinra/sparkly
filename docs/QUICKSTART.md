# Quick Start Guide

## Running the Application with Frontend

### Step 1: Start the Backend Server

Open a terminal and run:

```bash
npm run dev:backend
```

This will start the Express backend API on **http://localhost:3001**

### Step 2: Start the Frontend

Open a second terminal and run:

```bash
npm run dev:frontend
```

This will start the SvelteKit frontend on **http://localhost:5173**

### Step 3: Open in Browser

Navigate to **http://localhost:5173** in your web browser.

You should see:

- A **Devices** page listing your Twinkly devices
- A **Debug** page for inspecting device state and effects

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

1. Ensure `config.toml` exists and has the correct IP address
2. Make sure your Twinkly device is powered on and connected to the network
3. Verify you can ping the device from your computer

### Port Already in Use

If port 3001 or 5173 is already in use, you can:

- Stop the process using that port
- Or modify the port in [packages/backend/src/server.ts](../packages/backend/src/server.ts) (backend) or [packages/frontend/vite.config.mjs](../packages/frontend/vite.config.mjs) (frontend)
