import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ParameterType } from './types';

// Request/Response schemas for backend API
// Common base schema for requests that require device_id
const DeviceRequestBaseSchema = z.object({
  device_id: z.string(),
});

const HelloResponseSchema = z.object({
  message: z.string(),
});

const HslValueSchema = z.object({
  hue: z.number().min(0).max(1),
  saturation: z.number().min(0).max(1),
  lightness: z.number().min(0).max(1),
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
  step: z.number().optional(),
});

const BooleanEffectParameterSchema = EffectParameterBaseSchema.extend({
  type: z.literal(ParameterType.BOOLEAN),
  value: z.boolean(),
});

const HslEffectParameterSchema = EffectParameterBaseSchema.extend({
  type: z.literal(ParameterType.HSL),
  value: HslValueSchema,
});

const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

const OptionEffectParameterSchema = EffectParameterBaseSchema.extend({
  type: z.literal(ParameterType.OPTION),
  value: z.string(),
  options: z.array(OptionSchema),
});

const EffectParameterSchema = z.discriminatedUnion('type', [
  RangeEffectParameterSchema,
  BooleanEffectParameterSchema,
  HslEffectParameterSchema,
  OptionEffectParameterSchema,
]);

const GetInfoResponseSchema = z.object({
  devices: z.array(
    z.object({
      id: z.string(),
      alias: z.string(),
      ip: z.string().ip(),
      name: z.string().optional(),
      led_count: z.number().optional(),
      brightness: z.number().min(0).max(100).optional(),
      mode: z.string().optional(),
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

const DeviceDebugResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
    }))
});

const SetModeRequestSchema = DeviceRequestBaseSchema.extend({
  mode: z.string(),
});

const SetModeResponseSchema = z.object({
  success: z.boolean(),
  mode: z.string(),
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

const ParameterValueSchema = z.union([z.number(), z.boolean(), z.string(), HslValueSchema]);

const SetParametersRequestSchema = DeviceRequestBaseSchema.extend({
  parameters: z.array(
    z.object({
      id: z.string(),
      value: ParameterValueSchema,
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
export type DeviceDebugResponse = z.infer<typeof DeviceDebugResponseSchema>;
export type SetModeRequest = z.infer<typeof SetModeRequestSchema>;
export type SetModeResponse = z.infer<typeof SetModeResponseSchema>;
export type SetParametersRequest = z.infer<typeof SetParametersRequestSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Backend API contract
const DeviceModeSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
});

export type DeviceMode = z.infer<typeof DeviceModeSchema>;

const SystemInfoResponseSchema = z.object({
  buildDate: z.string().optional(),
  version: z.string().optional(),
  deviceModes: z.array(DeviceModeSchema),
});

export type SystemInfoResponse = z.infer<typeof SystemInfoResponseSchema>;

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
  debugDevice: {
    method: 'GET',
    path: '/api/debug/device',
    query: DeviceRequestBaseSchema,
    responses: {
      200: DeviceDebugResponseSchema,
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
  getSystemInfo: {
    method: 'GET',
    path: '/api/system-info',
    responses: {
      200: SystemInfoResponseSchema,
      500: ErrorResponseSchema,
    },
  },
});

