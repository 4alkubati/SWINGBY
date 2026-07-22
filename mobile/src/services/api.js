import axios from 'axios';
import { show as showToast } from './toast';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export { BASE_URL };

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

export function getAuthToken() {
  return _token;
}

export function getBaseUrl() {
  return BASE_URL;
}

/** Register a callback that fires when the API returns 401 (expired/invalid token). */
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

let _reqCounter = 0;

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  _reqCounter += 1;
  config.headers['X-Request-ID'] = `mob-${Date.now()}-${_reqCounter}`;

  if (config.url?.startsWith('/auth/')) {
    config.timeout = 30000;
  }
  return config;
});

// ─── T40: Retry interceptor (BEFORE the 401 handler) ─────────────────────────
// Retries on 5xx and network errors with exponential backoff: 300ms, 800ms, 2000ms.
// Only retries GET requests unless config._retryNonGet === true.
// Does not retry on 4xx except 408 (Request Timeout).
const RETRY_DELAYS = [300, 800, 2000];

// A retry re-enters the WHOLE interceptor chain (`api(config)` below), so the
// unwrap interceptor registered after this one has already turned the retried
// response into its body by the time control comes back here. Re-wrapping it as
// { data } lets the outer unwrap run a second time harmlessly and hand callers
// the same shape a first-try request returns — without this, every retried
// request resolved to `body.data` (usually undefined). Errors get flagged the
// same way so the outer handler doesn't toast the same failure twice.
const ALREADY_UNWRAPPED = '__swingbyRetryUnwrapped';

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

      // Mark retried writes so idempotent endpoints (e.g. POST /messages/) can
      // dedupe a request that may have already committed before the network
      // dropped its response. Harmless on GETs, which never dedupe server-side.
      if (!isGet) {
        config.headers = config.headers || {};
        config.headers['X-Send-Retry'] = String(config._retryCount);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const body = await api(config);
        return { data: body, [ALREADY_UNWRAPPED]: true };
      } catch (retryError) {
        retryError[ALREADY_UNWRAPPED] = true;
        return Promise.reject(retryError);
      }
    }

    return Promise.reject(error);
  }
);

// ─── Existing 401 handler + response unwrap ───────────────────────────────────
//
// FastAPI returns validation errors as { detail: [{loc, msg, type}, ...] } —
// an ARRAY of objects, not a string. Concatenating the array directly into
// `new Error(...)` stringifies to "[object Object]" and shows up that way in
// the UI. extractMessage walks every common error shape and always returns a
// plain string so the UI can render it.
export function extractMessage(error) {
  if (!error) return 'Something went wrong';
  const data = error.response?.data;

  if (data) {
    // FastAPI string detail: { detail: "Invalid credentials" }
    if (typeof data.detail === 'string') return data.detail;
    // FastAPI validation array: { detail: [{loc, msg}, ...] }
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d) => (typeof d === 'string' ? d : d?.msg || 'Validation error'))
        .join(', ');
    }
    // Generic { message: "..." } shape
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    // Object detail (rare): { detail: { msg: "..." } }
    if (data.detail?.msg) return String(data.detail.msg);
  }

  if (typeof error.message === 'string') return error.message;
  return 'Something went wrong';
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // A retried request already ran this handler once inside its own chain —
    // it was toasted and its message extracted there. Pass it straight through.
    if (error?.[ALREADY_UNWRAPPED]) return Promise.reject(error);
    if (error.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }
    const msg = extractMessage(error);
    // Callers can opt out of the global toast by passing `_silent: true` in the
    // request config (e.g. background polls like UnreadContext).
    if (error.response?.status !== 401 && !error.config?._silent) {
      showToast({ type: 'error', text1: 'Request failed', text2: msg });
    }
    return Promise.reject(new Error(msg));
  }
);

/**
 * Upload a file using native fetch (bypasses axios JSON encoding).
 * @param {string} endpoint  e.g. '/uploads/image'
 * @param {{ uri: string, type: string, name: string }} file  RN file descriptor
 * @returns {Promise<object>}  parsed JSON response body
 */
export async function uploadFile(endpoint, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    },
    body: formData,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server returned an invalid response');
  }

  if (!res.ok) {
    const msg = typeof data?.detail === 'string' ? data.detail : 'Upload failed';
    showToast({ type: 'error', text1: 'Upload failed', text2: msg });
    throw new Error(msg);
  }
  return data;
}
