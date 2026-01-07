import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GestaltResponseSchema, SummaryResponseSchema, Mode } from './apiContract';

// Request/Response schemas for backend API
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
});

const SetModeRequestSchema = z.object({
  mode: z.nativeEnum(Mode),
});

const SetModeResponseSchema = z.object({
  success: z.boolean(),
  mode: z.nativeEnum(Mode),
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
});
