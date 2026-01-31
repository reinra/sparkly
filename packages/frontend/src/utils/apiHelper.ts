/**
 * Centralized API error handling utility
 */

/**
 * Handles API responses with standard error handling logic
 * Logs errors to console and returns the parsed result or throws an error
 *
 * @param apiCall - The API call function to execute
 * @param errorMessage - Optional custom error message for user display
 * @returns The response body on success
 * @throws Error with user-friendly message on failure
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<{
    status: number;
    body: T | { error: string };
  }>,
  errorMessage?: string
): Promise<T> {
  try {
    const response = await apiCall();

    if (response.status === 200) {
      return response.body as T;
    } else if (response.status === 500 || response.status === 503) {
      const errorBody = response.body as { error: string };
      console.error('API error:', errorBody.error);
      throw new Error(errorMessage || errorBody.error || 'Request failed');
    } else {
      console.error('Unexpected response status:', response.status);
      throw new Error(errorMessage || 'Unexpected response from server');
    }
  } catch (error) {
    // If it's already our error, re-throw it
    if (error instanceof Error && error.message === errorMessage) {
      throw error;
    }

    // Network or other errors
    console.error('API call failed:', error);
    throw new Error(errorMessage || 'Failed to connect to backend. Make sure the server is running.');
  }
}

/**
 * Handles API calls with state management (for optimistic updates)
 * Automatically reverts state on error
 *
 * @param apiCall - The API call function to execute
 * @param onSuccess - Callback to execute on success
 * @param onError - Callback to execute on error (for state revert)
 * @returns Success status
 */
export async function handleApiUpdate<T>(
  apiCall: () => Promise<{
    status: number;
    body: T | { error: string };
  }>,
  onSuccess?: (body: T) => void,
  onError?: () => void
): Promise<boolean> {
  try {
    const response = await apiCall();

    if (response.status === 200) {
      if (onSuccess) {
        onSuccess(response.body as T);
      }
      return true;
    } else {
      const errorBody = response.body as { error: string };
      console.error('API error:', errorBody.error);
      if (onError) {
        onError();
      }
      return false;
    }
  } catch (error) {
    console.error('API call failed:', error);
    if (onError) {
      onError();
    }
    return false;
  }
}
