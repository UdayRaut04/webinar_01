'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import useSWR from 'swr';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'USER';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  mutate: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const token = api.getToken();
  if (!token) return null;
  const { user } = await api.getMe();
  return user;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const hasToken = typeof window !== 'undefined' ? !!api.getToken() : false;
  
  // Use SWR for caching and automatic revalidation
  const { data: user, error, mutate, isLoading } = useSWR(
    hasToken ? '/api/auth/me' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 60 seconds
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (!isLoading) {
      setInitialLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (error) {
      console.error('Failed to fetch user:', error);
      api.logout();
    }
  }, [error]);

  const login = async (email: string, password: string) => {
    const { user: userData } = await api.login(email, password);
    mutate(userData, false);
  };

  const register = async (email: string, password: string, name?: string) => {
    const { user: userData } = await api.register(email, password, name);
    mutate(userData, false);
  };

  const logout = () => {
    api.logout();
    mutate(null, false);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        loading: initialLoading,
        login,
        register,
        logout,
        isAdmin: user?.role === 'ADMIN',
        mutate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
