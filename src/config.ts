import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { parse as parseToml } from 'smol-toml';
import { join } from 'path';

// Define config schema with Zod
const ConfigSchema = z.object({
  device: z.object({
    ip: z.string().ip(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const configPath = join(__dirname, '..', 'config.toml');

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
