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

// ─── T40: Retry interceptor (BEFORE the 401 handler) ─────────────────────────
// Retries on 5xx and network errors with exponential backoff: 300ms, 800ms, 2000ms.
// Only retries GET requests unless config._retryNonGet === true.
// Does not retry on 4xx except 408 (Request Timeout).
const RETRY_DELAYS = [300, 800, 2000];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (!config) return Promise.reject(error);

    const status = error.response?.status;
    const isNetworkError = !error.response;
    const is5xx = status >= 500;
    const is408 = status === 408;
    const shouldRetry = isNetworkError || is5xx || is408;

    const isGet = config.method?.toUpperCase() === 'GET';
    const allowedToRetry = isGet || config._retryNonGet === true;

    config._retryCount = config._retryCount || 0;

    if (shouldRetry && allowedToRetry && config._retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[config._retryCount];
      config._retryCount += 1;

      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// ─── Existing 401 handler + response unwrap ───────────────────────────────────
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
