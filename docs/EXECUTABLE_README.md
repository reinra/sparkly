# Sparkly

LED controller for Twinkly smart LED devices. Control effects, brightness, and colors through a web interface.

## Getting Started

1. **Run** `sparkly.exe`
2. **Open** your browser to **http://localhost:3001**

That's it — no installation required.

## Using Sparkly

### Adding Devices

Open the **Devices** page in your browser. You can add Twinkly devices in two ways:

- **Discover** — Automatically scans your network for Twinkly devices
- **Add by IP** — Enter a device's IP address manually

Devices are saved automatically between sessions.

### Controlling Devices

Each device card lets you:

- **Set mode** — Switch between off, color, effect, and other modes
- **Adjust brightness** — 0–100%
- **Choose an effect** — Pick from the effect library
- **Tune parameters** — Customize colors, speed, and other settings
- **Send movie** — Render an effect and upload it to the device hardware

### Debug Page

The **Debug** page shows detailed device info and effect metadata — helpful for diagnosing connection issues.

## Troubleshooting

| Problem                              | Solution                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| **Windows SmartScreen warning**       | Click **More info**, then click **Run anyway**                    |
| **"Unknown Publisher" security warning** | Click **Run** to proceed                                       |
| **Can't find devices**               | Make sure Twinkly devices are powered on and on the same network  |
| **Port 3001 in use**                 | Close any other application using that port, then restart Sparkly |
| **"Frontend failed to load"**        | Try re-downloading the latest release                             |
| **Device won't respond**             | Try the Reconnect button, or verify you can ping the device IP    |

## Logs

The server prints log messages to the console window. Check there for error details if something isn't working.

## Building from Source

To build this executable yourself:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build all packages: `npm run build`
4. Build executable: `npm run build:executable`

The executable will be created in the `dist/` directory.
