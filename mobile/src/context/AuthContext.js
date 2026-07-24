import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { setAuthToken, setUnauthorizedHandler, setRefreshHandler, getAuthToken } from '../services/api';
import {
  login as svcLogin,
  signup as svcSignup,
  getStoredToken,
  clearToken,
  getMe,
  refreshSession,
} from '../services/auth';
import { registerForPushAsync, unregisterPushAsync } from '../services/notifications';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // True only when the session on screen came from a stored token on cold
  // boot (not an interactive login/signup just now). CARD-24's biometric
  // lock only gates this path — nobody gets re-prompted for FaceID right
  // after typing their password.
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  // Keep a stable ref so the 401 handler always has the latest logout fn.
  const logoutRef = useRef(null);

  // Exchange the refresh token for a new access token and sync it into both the
  // axios client and React state. The api.js 401 interceptor calls this (via
  // the registered handler) and single-flights concurrent calls, so this stays
  // simple. Returns the new token, or null when the session is truly gone.
  async function refresh() {
    const newToken = await refreshSession();
    if (newToken) {
      setAuthToken(newToken);
      setToken(newToken);
    }
    return newToken;
  }

  // Register the 401 → refresh and 401 → logout handlers BEFORE the bootstrap
  // effect below can fire a request. On cold boot the stored access token may
  // already be expired, so getMe() 401s; with the refresh handler in place the
  // interceptor transparently refreshes and the session survives. Effects run
  // top-to-bottom on mount, and setRefreshHandler is synchronous, so it is set
  // before bootstrap's first await resolves.
  useEffect(() => {
    setRefreshHandler(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredToken();
        if (stored) {
          setAuthToken(stored);
          // If the stored access token is expired, this 401s and the interceptor
          // refreshes it under the hood, returning a valid /auth/me response.
          const me = await getMe();
          // Use the live token, not `stored` — an interceptor refresh during
          // getMe may have already replaced it.
          setToken(getAuthToken() || stored);
          setUser(me);
          setRestoredFromStorage(true);
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
    try { await registerForPushAsync(); } catch { /* non-fatal */ }
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
    try { await registerForPushAsync(); } catch { /* non-fatal */ }
    return { requiresConfirmation: false, user: me };
  }

  async function logout() {
    // Drop this device's push token FIRST — while the request is still
    // authenticated — so the next user on this device doesn't inherit the
    // previous user's notifications. Non-fatal; never blocks sign-out.
    try { await unregisterPushAsync(); } catch { /* non-fatal */ }
    await clearToken();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setRestoredFromStorage(false);
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
    <AuthContext.Provider value={{ user, token, isLoading, restoredFromStorage, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
