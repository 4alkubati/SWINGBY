import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

let _token = null;
let _onUnauthorized = null;

export function setAuthToken(token) {
  _token = token;
}

/** Register a callback that fires when the API returns 401 (expired/invalid token). */
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';
    return Promise.reject(new Error(message));
  }
);
