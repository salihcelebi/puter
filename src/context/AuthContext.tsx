import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthApiError } from '../lib/authApi';

interface User {
  id: string;
  email: string;
  kullanici_adi: string;
  gorunen_ad: string;
  rol: 'user' | 'admin';
  toplam_kredi: number;
  kullanilan_kredi: number;
  permissions?: Record<string, boolean>;
  permission_summary?: string | null;
  is_system_user?: boolean;
  is_seeded?: boolean;
  is_new_user?: boolean;
  notes?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const data = await authApi.me<{ user: User }>();
      setUser(data.user);
      setAuthError(null);
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          setUser(null);
          setAuthError(null);
        } else {
          console.error('Auth check failed:', error);
          setUser(null);
          setAuthError(error.message);
        }
      } else {
        console.error('Auth check failed:', error);
        setUser(null);
        setAuthError('Auth API erişilemiyor. Deploy ortamında backend çalışmıyor olabilir.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    setAuthError(null);
  };

  const logout = async () => {
    try {
      await authApi.logout<{ message: string }>();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, logout, checkAuth, clearAuthError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
