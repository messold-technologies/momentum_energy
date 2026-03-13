const TOKEN_KEY = 'momentum_portal_token';
let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return memoryToken ?? localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthStorage(): void {
  memoryToken = null;
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export interface User {
  id: string;
  email: string;
  name: string;
}
