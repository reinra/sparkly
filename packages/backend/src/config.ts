import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { parse as parseToml } from 'smol-toml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect if running in Bun bundled executable
const isBundledExecutable = typeof process !== 'undefined' && 
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

export function loadConfig(): Config {
  // In bundled executable, look for config.toml in the current working directory
  // In development, look relative to the compiled output directory
  const configPath = isBundledExecutable 
    ? join(process.cwd(), 'config.toml')
    : join(__dirname, '..', 'config.toml');

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
