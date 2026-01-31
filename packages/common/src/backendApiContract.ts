import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GestaltResponseSchema, SummaryResponseSchema, Mode } from './types';

// Request/Response schemas for backend API
// Common base schema for requests that require device_id
const DeviceRequestBaseSchema = z.object({
  device_id: z.string(),
});

const HelloResponseSchema = z.object({
  message: z.string(),
});

const GetInfoResponseSchema = z.object({
  devices: z.array(
    z.object({
      id: z.string(),
      alias: z.string(),
      ip: z.string().ip(),
      name: z.string().optional(),
      led_count: z.number().optional(),
      brightness: z.number().min(0).max(100).optional(),
      mode: z.nativeEnum(Mode).optional(),
      effect_id: z.string().nullable(),
    })
  ),
  effects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
});

const LedConfigResponseSchema = z.object({
  code: z.number(),
  strings: z.array(
    z.object({
      first_led_id: z.number(),
      length: z.number(),
    })
  ),
});

const StatusResponseSchema = z.object({
  device: GestaltResponseSchema,
  summary: SummaryResponseSchema,
  ledConfig: LedConfigResponseSchema,
  movieConfig: z.string(),
});

const SetModeRequestSchema = DeviceRequestBaseSchema.extend({
  mode: z.nativeEnum(Mode),
});

const SetModeResponseSchema = z.object({
  success: z.boolean(),
  mode: z.nativeEnum(Mode),
});

const SetBrightnessRequestSchema = DeviceRequestBaseSchema.extend({
  brightness: z.number().min(0).max(100),
});

const ChooseEffectRequestSchema = DeviceRequestBaseSchema.extend({
  effect_id: z.string().nullable(),
});

const SendMovieRequestSchema = DeviceRequestBaseSchema.extend({
  effect_id: z.string(),
});

const GetBufferResponseSchema = z.object({
  base64_encoded: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be valid base64").nullable(),
});

const GenericSuccessResponseSchema = z.object({
  success: z.boolean(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

// Export types
export type HelloResponse = z.infer<typeof HelloResponseSchema>;
export type GetInfoResponse = z.infer<typeof GetInfoResponseSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type SetModeRequest = z.infer<typeof SetModeRequestSchema>;
export type SetModeResponse = z.infer<typeof SetModeResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Backend API contract
const c = initContract();
export const backendApiContract = c.router({
  hello: {
    method: 'GET',
    path: '/api/hello',
    responses: {
      200: HelloResponseSchema,
    },
  },
  getInfo: {
    method: 'GET',
    path: '/api/info',
    responses: {
      200: GetInfoResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  status: {
    method: 'GET',
    path: '/api/status',
    responses: {
      200: StatusResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  setMode: {
    method: 'POST',
    path: '/api/mode',
    body: SetModeRequestSchema,
    responses: {
      200: SetModeResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  setBrightness: {
    method: 'POST',
    path: '/api/brightness',
    body: SetBrightnessRequestSchema,
    responses: {
      200: GenericSuccessResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  chooseEffect: {
    method: 'POST',
    path: '/api/effect',
    body: ChooseEffectRequestSchema,
    responses: {
      200: GenericSuccessResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  getBuffer: {
    method: 'GET',
    path: '/api/buffer',
    query: DeviceRequestBaseSchema,
    responses: {
      200: GetBufferResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  sendMovie: {
    method: 'POST',
    path: '/api/sendMovie',
    body: SendMovieRequestSchema,
    responses: {
      200: GenericSuccessResponseSchema,
      500: ErrorResponseSchema,
    },
  }
});
