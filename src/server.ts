import express from 'express';
import cors from 'cors';
import { TwinklyApiClient } from './apiClient';
import { loadConfig } from './config';
import { Mode } from './apiContract';

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Hello World endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Twinkly Backend!' });
});

// Get device status
app.get('/api/status', async (req, res) => {
  try {
    const config = loadConfig();
    const apiClient = new TwinklyApiClient(config.device.ip);

    const gestalt = await apiClient.gestalt();
    const summary = await apiClient.getSummary();

    await apiClient.close();

    res.json({
      device: gestalt,
      summary: summary,
    });
  } catch (error) {
    console.error('Error getting device status:', error);
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

// Set mode endpoint
app.post('/api/mode', async (req, res) => {
  try {
    const { mode } = req.body;
    const config = loadConfig();
    const apiClient = new TwinklyApiClient(config.device.ip);

    await apiClient.gestalt();
    await apiClient.setMode(mode as Mode);
    await apiClient.close();

    res.json({ success: true, mode });
  } catch (error) {
    console.error('Error setting mode:', error);
    res.status(500).json({ error: 'Failed to set mode' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
