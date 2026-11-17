import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fg_token');
    const savedUser = localStorage.getItem('fg_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser) as User);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch {
        localStorage.removeItem('fg_token');
        localStorage.removeItem('fg_user');
      }
    }
    setLoading(false);
  }, []);

  function login(token: string, userData: User) {
    localStorage.setItem('fg_token', token);
    localStorage.setItem('fg_user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('fg_token');
    localStorage.removeItem('fg_user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
