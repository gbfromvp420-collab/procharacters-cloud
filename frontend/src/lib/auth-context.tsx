"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, login as apiLogin, register as apiRegister } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const TOKEN_KEY = "procharacters_token";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for stored token
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    getMe(stored)
      .then(({ user: u }) => {
        setUser(u);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, displayName?: string) => {
    const result = await apiRegister(email, username, password, displayName);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
