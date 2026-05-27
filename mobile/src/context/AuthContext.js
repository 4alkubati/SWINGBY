import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../services/api';
import { login as svcLogin, signup as svcSignup, getStoredToken, clearToken, getMe } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Keep a stable ref so the 401 handler always has the latest logout fn.
  const logoutRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredToken();
        if (stored) {
          setAuthToken(stored);
          const me = await getMe();
          setToken(stored);
          setUser(me);
        }
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const t = await svcLogin(email, password);
    setAuthToken(t);
    const me = await getMe();
    setToken(t);
    setUser(me);
    return me;
  }

  async function signup(payload) {
    const result = await svcSignup(payload);
    if (result.requiresConfirmation) {
      // Email confirmation required — don't try to fetch profile yet.
      // Caller should redirect to a "check your email" message.
      return { requiresConfirmation: true };
    }
    // Session issued immediately (email confirmation OFF) — auto-login.
    setAuthToken(result.token);
    const me = await getMe();
    setToken(result.token);
    setUser(me);
    return { requiresConfirmation: false, user: me };
  }

  async function logout() {
    await clearToken();
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  // Register logout as the 401 handler whenever it changes.
  useEffect(() => {
    logoutRef.current = logout;
    setUnauthorizedHandler(() => logoutRef.current?.());
  });

  function updateUser(updates) {
    setUser((prev) => ({ ...prev, ...updates }));
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
