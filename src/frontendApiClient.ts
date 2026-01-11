import { initClient } from '@ts-rest/core';
import { backendApiContract } from './backendApiContract';

// Create a type-safe client for the backend API
export const backendClient = initClient(backendApiContract, {
  baseUrl: 'http://localhost:3001',
  baseHeaders: {},
  // Enable runtime validation to catch type mismatches
  jsonQuery: true,
});

// Export types for convenience
export type {
  HelloResponse,
  GetInfoResponse,
  StatusResponse,
  SetModeRequest,
  SetModeResponse,
} from './backendApiContract';
export { Mode } from './apiContract';
