import { initClient } from '@ts-rest/core';
import { backendApiContract } from '@sparkly/common';

// Create a type-safe client for the backend API
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001'; // Fallback for SSR
};

export const backendClient = initClient(backendApiContract, {
  baseUrl: getBaseUrl(),
  baseHeaders: {},
  // Enable runtime validation to catch type mismatches
  jsonQuery: true,
});

// Export types for convenience
export type {
  HelloResponse,
  GetInfoResponse,
  DeviceDebugResponse,
  SetModeRequest,
  SetModeResponse,
  SystemInfoResponse,
  MovieTaskProgressResponse,
  GetMovieStatusResponse,
  DebugEffectsResponse,
} from '@sparkly/common';
