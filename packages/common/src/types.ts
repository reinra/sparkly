import { z } from 'zod';

// Mode enum shared between backend and frontend
// This represents the operating mode of Twinkly devices
export enum Mode {
  off = 'off',
  demo = 'demo',
  effect = 'effect',
  movie = 'movie',
  rt = 'rt',
}

// Schemas used in device responses (needed by backend API contract)
const BasicResponseSchema = z.object({
  code: z.number(),
});

export const GestaltResponseSchema = BasicResponseSchema.extend({
  product_name: z.string(),
  hardware_version: z.string(),
  bytes_per_led: z.number(),
  hw_id: z.string(),
  flash_size: z.number(),
  led_type: z.number(),
  product_code: z.string(),
  fw_family: z.string(),
  device_name: z.string(),
  uptime: z.string(),
  mac: z.string(),
  uuid: z.string(),
  max_supported_led: z.number(),
  number_of_led: z.number(),
  led_profile: z.string(),
  frame_rate: z.number(),
  measured_frame_rate: z.number(),
  movie_capacity: z.number(),
  max_movies: z.number(),
  wire_type: z.number(),
  compatibility_mode: z.string(),
  copyright: z.string(),
});

export const SummaryResponseSchema = BasicResponseSchema.extend({
  led_mode: z.object({
    mode: z.nativeEnum(Mode),
    detect_mode: z.number(),
    shop_mode: z.number(),
    id: z.number().optional(),
    unique_id: z.string().optional(),
    name: z.string().optional(),
  }),
  timer: z.object({
    time_now: z.number(),
    time_on: z.number(),
    time_off: z.number(),
    tz: z.string(),
  }),
  music: z.object({
    enabled: z.number(),
    active: z.number(),
    auto: z.string().optional(),
    auto_mode: z.string(),
    current_driverset: z.number(),
    mood_index: z.number(),
  }),
  filters: z.array(
    z.object({
      filter: z.string(),
      config: z.object({
        value: z.number(),
        mode: z.enum(['enabled', 'disabled']),
      }),
    })
  ),
  group: z.object({
    mode: z.string(),
    compat_mode: z.number(),
  }),
  color: z.object({
    hue: z.number(),
    saturation: z.number(),
    value: z.number(),
    red: z.number(),
    green: z.number(),
    blue: z.number(),
  }),
});
