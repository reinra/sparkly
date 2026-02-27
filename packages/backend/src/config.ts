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
  (process.execPath?.includes('twinkly-server') || process.argv[0]?.includes('twinkly-server'));

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
    throw new Error(
      `Configuration file not found: ${configPath}\n\n` +
        `Please create a config.toml file by copying config.toml.example:\n` +
        `  cp config.toml.example config.toml\n\n` +
        `Then update it with your Twinkly device's IP address.`
    );
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
  const configContent = readFileSync(configPath, 'utf-8');
  const parsed = parseToml(configContent) as Record<string, unknown>;

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
  const configContent = readFileSync(configPath, 'utf-8');
  const parsed = parseToml(configContent) as Record<string, unknown>;

  const devices = (parsed.device ?? []) as Array<{ ip: string }>;
  parsed.device = devices.filter((d) => d.ip !== ip);

  writeFileSync(configPath, stringifyToml(parsed), 'utf-8');
}
