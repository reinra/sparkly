import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const BasicResponseSchema = z.object({
  code: z.number()
});

const GestaltResponseSchema = BasicResponseSchema.extend({
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
  copyright: z.string()
});

const LoginRequestSchema = z.object({
  challenge: z.string()
});
const LoginResponseSchema = BasicResponseSchema.extend({
  authentication_token: z.string(),
  authentication_token_expires_in: z.number(),
  "challenge-response": z.string()
});

const VerifyRequestSchema = z.object({
  "challenge-response": z.string()
});

export enum Mode {
  off = "off",
  demo = "demo",
  effect = "effect",
  movie = "movie",
  rt = "rt"
}
const SetModeReqestSchema = z.object({
  mode: z.nativeEnum(Mode),
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
    headers: z.object({
      "x-auth-token": z.string(),
    }),
    body: VerifyRequestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
  setMode: {
    method: 'POST',
    path: '/xled/v1/led/mode',
    headers: z.object({
      "x-auth-token": z.string(),
    }),
    body: SetModeReqestSchema,
    responses: {
      200: BasicResponseSchema,
    },
  },
});
