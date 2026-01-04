import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { GestaltResponseSchema, SummaryResponseSchema, Mode } from './apiContract';

// Request/Response schemas for backend API
const HelloResponseSchema = z.object({
  message: z.string(),
});

const StatusResponseSchema = z.object({
  device: GestaltResponseSchema,
  summary: SummaryResponseSchema,
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
