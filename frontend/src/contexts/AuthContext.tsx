/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '../lib/api';
import { setAuthToken } from '../lib/auth';

const TOKEN_KEY = 'momentum_portal_token';

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { user: null, token: null, loading: false };
    }
    setAuthToken(token);
    return { user: null, token, loading: true };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setState({ user: null, token: null, loading: false });
  }, []);

  useEffect(() => {
    const token = state.token;
    if (!token) return;
    authApi
      .me()
      .then((res) => {
        setState({
          user: res.user,
          token,
          loading: false,
        });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
        setState({ user: null, token: null, loading: false });
      });
  }, [state.token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      if (res.token && res.user) {
        localStorage.setItem(TOKEN_KEY, res.token);
        setAuthToken(res.token);
        setState({ user: res.user, token: res.token, loading: false });
      } else {
        throw new Error('Invalid response from login');
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      await authApi.register(email, name, password);
    },
    []
  );

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
