import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
  registerBegin,
  registerComplete,
  loginBegin,
  loginComplete,
  me as apiMe,
  logout as apiLogout,
  type UserOut,
} from '../lib/api';
import { getToken, setToken } from '../lib/storage';

type AuthContextValue = {
  token: string | null;
  user: UserOut | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  register: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore errors on logout
    }
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
      setToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshMe();
      setIsLoading(false);
    })();
  }, [refreshMe]);

  const login = useCallback(async (email: string) => {
    // Step 1: Get authentication options from server
    const options = await loginBegin(email);
    
    // Step 2: Trigger browser passkey prompt
    const credential = await startAuthentication({ optionsJSON: options as any });
    
    // Step 3: Verify with server and get token
    const res = await loginComplete(email, credential);
    setToken(res.access_token);
    setTokenState(res.access_token);
    await refreshMe();
  }, [refreshMe]);

  const register = useCallback(async (email: string) => {
    // Step 1: Get registration options from server
    const options = await registerBegin(email);
    
    // Step 2: Trigger browser passkey creation prompt
    const credential = await startRegistration({ optionsJSON: options as any });
    
    // Step 3: Verify with server and create user
    const res = await registerComplete(email, credential);
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
