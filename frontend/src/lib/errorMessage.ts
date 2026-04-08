import { isAxiosError } from 'axios';

/**
 * Prefer backend { error } messages for Axios requests, otherwise fall back to JS error message.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const apiMsg = isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
  return apiMsg ?? (err instanceof Error ? err.message : undefined) ?? fallback;
}

