import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running in Bun bundled executable
const isBundledExecutable =
  typeof process !== 'undefined' &&
  (process.execPath?.includes('sparkly') || process.argv[0]?.includes('sparkly'));

// Define config schema with Zod
const ConfigSchema = z.object({
  device: z.array(
    z.object({
      ip: z.string().ip(),
    })
  ),
});

export type Config = z.infer<typeof ConfigSchema>;

export function getConfigPath(): string {
  return isBundledExecutable ? join(process.cwd(), 'config.toml') : join(__dirname, '..', 'config.toml');
}

export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    // No config file yet — start with an empty device list.
    // Devices can be added at runtime via the UI.
    return { device: [] };
  }

  const configContent = readFileSync(configPath, 'utf-8');
  const parsedToml = parseToml(configContent);
  return ConfigSchema.parse(parsedToml);
}

/**
 * Add a device entry to config.toml.
 * Reads the current config, appends the new device, and writes back using smol-toml.
 */
export function addDeviceToConfig(ip: string): void {
  const configPath = getConfigPath();
  const parsed: Record<string, unknown> = existsSync(configPath)
    ? (parseToml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>)
    : {};

  const devices = (parsed.device ?? []) as Array<{ ip: string }>;
  devices.push({ ip });
  parsed.device = devices;

  writeFileSync(configPath, stringifyToml(parsed), 'utf-8');
}

/**
 * Remove a device entry from config.toml by IP address.
 * Reads the current config, filters out the matching device, and writes back.
 */
export function removeDeviceFromConfig(ip: string): void {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return;
  const parsed = parseToml(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

  const devices = (parsed.device ?? []) as Array<{ ip: string }>;
  parsed.device = devices.filter((d) => d.ip !== ip);

  writeFileSync(configPath, stringifyToml(parsed), 'utf-8');
}
