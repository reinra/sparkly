import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { LedType } from './backend/effects/Color';

export const EnabledDisabledSchema = z.enum(['enabled', 'disabled']);
export const AbsoluteOrRelativeSchema = z.enum(['A', 'R']);

export enum Mode {
  off = 'off',
  demo = 'demo',
  effect = 'effect',
  movie = 'movie',
  rt = 'rt',
}

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
  led_profile: z.nativeEnum(LedType),
  frame_rate: z.number(),
  measured_frame_rate: z.number(),
  movie_capacity: z.number(),
  max_movies: z.number(),
  wire_type: z.number(),
  compatibility_mode: z.string(),
  copyright: z.string(),
});

const LoginRequestSchema = z.object({
  challenge: z.string(),
});
const LoginResponseSchema = BasicResponseSchema.extend({
  authentication_token: z.string(),
  authentication_token_expires_in: z.number(),
  'challenge-response': z.string(),
});

const VerifyRequestSchema = z.object({
  'challenge-response': z.string(),
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
        mode: EnabledDisabledSchema,
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
  layout: z.object({
    uuid: z.string(),
  }),
});

const SetModeReqestSchema = z.object({
  mode: z.nativeEnum(Mode),
});

const SetBrightnessRequestSchema = z.object({
  mode: EnabledDisabledSchema,
  type: AbsoluteOrRelativeSchema,
  value: z.number().min(-100).max(100),
});

const ListMoviesResponseSchema = BasicResponseSchema.extend({
  movies: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      unique_id: z.string(),
      descriptor_type: z.string(),
      leds_per_frame: z.number(),
      frames_number: z.number(),
      fps: z.number(),
    })
  ),
  available_frames: z.number(),
  max_capacity: z.number(),
  max: z.number(),
});

const GetLayoutResponseSchema = BasicResponseSchema.extend({
  aspectXY: z.number(),
  aspectXZ: z.number(),
  coordinates: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    })
  ),
  source: z.string(),
  synthesized: z.boolean(),
  uuid: z.string(),
});

const GetLedConfigResponseSchema = BasicResponseSchema.extend({
  strings: z.array(
    z.object({
      first_led_id: z.number(),
      length: z.number(),
    })
  ),
});

const authHeaders = z.object({
  'x-auth-token': z.string().optional(),
});

const c = initContract();
export const apiContract = c.router({
  gestalt: {
    method: 'GET',
    path: '/xled/v1/gestalt',
    responses: {
      200: GestaltResponseSchema,
    },
  },
  login: {
    method: 'POST',
    path: '/xled/v1/login',
    body: LoginRequestSchema,
    responses: {
      200: LoginResponseSchema,
    },
  },
  verify: {
    method: 'POST',
    path: '/xled/v1/verify',
    headers: authHeaders,
    body: VerifyRequestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
  summary: {
    method: 'GET',
    path: '/xled/v1/summary',
    headers: authHeaders,
    responses: {
      200: SummaryResponseSchema,
    },
  },
  setMode: {
    method: 'POST',
    path: '/xled/v1/led/mode',
    headers: authHeaders,
    body: SetModeReqestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
  setBrightness: {
    method: 'POST',
    path: '/xled/v1/led/out/brightness',
    headers: authHeaders,
    body: SetBrightnessRequestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
  listMovies: {
    method: 'GET',
    path: '/xled/v1/movies',
    headers: authHeaders,
    responses: {
      200: ListMoviesResponseSchema,
    },
  },
  getLayout: {
    method: 'GET',
    path: '/xled/v1/led/layout/full',
    headers: authHeaders,
    responses: {
      200: GetLayoutResponseSchema,
    },
  },
  getLedConfig: {
    method: 'GET',
    path: '/xled/v1/led/config',
    headers: authHeaders,
    responses: {
      200: GetLedConfigResponseSchema,
    },
  },
});
