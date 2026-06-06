// Use our cross-platform storage wrapper instead of expo-secure-store directly.
// Routes to native SecureStore on iOS/Android, localStorage on web. Same API.
import * as SecureStore from './storage';
import { api } from './api';

const TOKEN_KEY = 'swingby_token';

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  return data.access_token;
}

export async function signup(payload) {
  const data = await api.post('/auth/signup', payload);
  if (data.access_token) {
    // Email confirmation is OFF — session issued immediately, auto-login.
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    return { token: data.access_token, requiresConfirmation: false };
  }
  // Email confirmation is ON — user must confirm before logging in.
  return { token: null, requiresConfirmation: true };
}

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getMe() {
  return api.get('/auth/me');
}

export async function updateMe(payload) {
  return api.patch('/auth/me', payload);
}
