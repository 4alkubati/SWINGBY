import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../services/api';
import { login as svcLogin, signup as svcSignup, getStoredToken, clearToken, getMe } from '../services/auth';
import { registerForPushAsync } from '../services/notifications';
import { isBiometricEnabled, isBiometricHardwareReady } from '../services/biometrics';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // CARD-24 — biometric unlock gate. When a stored session exists AND the
  // user opted in AND the device still has biometrics enrolled, boot defers
  // restoring the session until BiometricLockScreen reports success. The
  // token stays in SecureStore untouched the whole time — nothing here ever
  // logs the user out just because a biometric check didn't run.
  const [needsBiometric, setNeedsBiometric] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  // Keep a stable ref so the 401 handler always has the latest logout fn.
  const logoutRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredToken();
        if (stored) {
          const bioEnabled = await isBiometricEnabled();
          // Degrade gracefully: no enrolled biometrics / no hardware → skip
          // the gate entirely and restore the session exactly as before.
          const bioReady = bioEnabled && (await isBiometricHardwareReady());
          if (bioReady) {
            setPendingToken(stored);
            setNeedsBiometric(true);
            setIsLoading(false);
            return;
          }
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

  // Called by BiometricLockScreen after a successful Face ID / Touch ID /
  // fingerprint prompt — finishes the session restore that boot deferred.
  async function completeBiometricUnlock() {
    try {
      setAuthToken(pendingToken);
      const me = await getMe();
      setToken(pendingToken);
      setUser(me);
    } catch {
      // Stored token turned out to be invalid/expired — clear it so the
      // user lands on a clean Login screen instead of a dead retry loop.
      await clearToken();
    } finally {
      setNeedsBiometric(false);
      setPendingToken(null);
    }
  }

  // The graceful-fallback escape hatch: user declined/failed biometrics.
  // The stored token is left alone (not cleared) — they just log in fresh
  // with their password, same as any other cold start without biometrics.
  function skipBiometric() {
    setNeedsBiometric(false);
    setPendingToken(null);
  }

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
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        needsBiometric,
        completeBiometricUnlock,
        skipBiometric,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
