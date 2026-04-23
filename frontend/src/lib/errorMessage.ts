import { isAxiosError } from 'axios';

/**
 * Prefer backend { error } messages for Axios requests, otherwise fall back to JS error message.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: string; message?: string; name?: string; details?: unknown }
      | string
      | undefined;

    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      if (typeof data.error === 'string' && data.error.trim()) return data.error;
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
    }
  }

  return (err instanceof Error ? err.message : undefined) ?? fallback;
}

