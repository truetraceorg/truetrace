import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, me as apiMe, register as apiRegister, type UserOut } from '../lib/api';
import { getToken, setToken } from '../lib/storage';

type AuthContextValue = {
  token: string | null;
  user: UserOut | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const u = await apiMe();
      setUser(u);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshMe();
      setIsLoading(false);
    })();
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.access_token);
    setTokenState(res.access_token);
    await refreshMe();
  }, [refreshMe]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await apiRegister(email, password);
    setToken(res.access_token);
    setTokenState(res.access_token);
    await refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isLoading, login, register, logout, refreshMe }),
    [token, user, isLoading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

