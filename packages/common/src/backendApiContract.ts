import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { Mode, ParameterType } from './types';

// Request/Response schemas for backend API
// Common base schema for requests that require device_id
const DeviceRequestBaseSchema = z.object({
  device_id: z.string(),
});

const HelloResponseSchema = z.object({
  message: z.string(),
});

const EffectParameterBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(ParameterType),
});

const RangeEffectParameterSchema = EffectParameterBaseSchema.extend({
  type: z.literal(ParameterType.RANGE),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  unit: z.string().optional(),
});

const BooleanEffectParameterSchema = EffectParameterBaseSchema.extend({
  type: z.literal(ParameterType.BOOLEAN),
  value: z.boolean(),
});

const EffectParameterSchema = z.discriminatedUnion('type', [RangeEffectParameterSchema, BooleanEffectParameterSchema]);

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
      parameters: z.array(EffectParameterSchema),
    })
  ),
  effects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
});

const StatusResponseSchema = z.object({
  device: z.string(),
  summary: z.string(),
  ledConfig: z.string(),
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

const SetParametersRequestSchema = DeviceRequestBaseSchema.extend({
  parameters: z.array(
    z.object({
      id: z.string(),
      value: z.union([z.number(), z.boolean()]),
    })
  ),
});

const GetBufferResponseSchema = z.object({
  base64_encoded: z
    .string()
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Must be valid base64')
    .nullable(),
});

const GetLedMappingResponseSchema = z.object({
  coordinates: z.array(
    z.object({
      id: z.number(),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
  ),
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
export type SetParametersRequest = z.infer<typeof SetParametersRequestSchema>;
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
  /**
   * Get info about connected devices and available effects
   * Client fetches it again for single device after modifying any settings.
   */
  getInfo: {
    method: 'GET',
    path: '/api/info',
    query: z.object({
      device_id: z.string().optional(),
    }),
    responses: {
      200: GetInfoResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  /**
   * For debugging, not for main usage
   */
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
  getLedMapping: {
    method: 'GET',
    path: '/api/ledMapping',
    query: DeviceRequestBaseSchema,
    responses: {
      200: GetLedMappingResponseSchema,
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
  },
  setParameters: {
    method: 'POST',
    path: '/api/parameters',
    body: SetParametersRequestSchema,
    responses: {
      200: GenericSuccessResponseSchema,
      500: ErrorResponseSchema,
    },
  },
});
