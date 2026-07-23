// Use our cross-platform storage wrapper instead of expo-secure-store directly.
// Routes to native SecureStore on iOS/Android, localStorage on web. Same API.
import * as SecureStore from './storage';
import { api } from './api';

const TOKEN_KEY = 'swingby_token';
const REFRESH_KEY = 'swingby_refresh_token';

// Persist both tokens together. The refresh token is what lets the app mint a
// new access token (see refreshSession) instead of logging the user out when
// the ~1h access token expires. May be null if the backend didn't issue one.
async function storeSession(accessToken, refreshToken) {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }
}

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  await storeSession(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function signup(payload) {
  const data = await api.post('/auth/signup', payload);
  if (data.access_token) {
    // Email confirmation is OFF — session issued immediately, auto-login.
    await storeSession(data.access_token, data.refresh_token);
    return { token: data.access_token, requiresConfirmation: false };
  }
  // Email confirmation is ON — user must confirm before logging in.
  return { token: null, requiresConfirmation: true };
}

// Exchange the stored refresh token for a fresh access/refresh pair. Returns
// the new access token, or null if there's nothing to refresh with or the
// exchange fails (expired/revoked refresh token → the user really is logged
// out). `_silent` keeps a failed refresh from firing the global error toast,
// and the /auth/refresh path is excluded from the 401→refresh interceptor so
// this can't recurse.
export async function refreshSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const data = await api.post(
      '/auth/refresh',
      { refresh_token: refreshToken },
      { _silent: true },
    );
    if (!data?.access_token) return null;
    await storeSession(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getMe() {
  return api.get('/auth/me');
}

export async function updateMe(payload) {
  return api.patch('/auth/me', payload);
}
