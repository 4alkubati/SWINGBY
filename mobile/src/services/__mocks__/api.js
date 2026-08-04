// Manual mock for the axios-based api client.
//
// Screen tests that render a component which fetches on mount should enable
// this with `jest.mock('<path>/services/api')` at the top of the file, then
// override per-test:  api.get.mockResolvedValueOnce({ ... }).
//
// Every method resolves empty by default so a screen mounts without hitting
// the network and without a dangling promise. `extractMessage` keeps its real
// shape because components render its output directly.
//
// MOCK THE UNWRAPPED BODY, NOT THE AXIOS RESPONSE.
//
// The real client installs a response interceptor that returns `response.data`
// (services/api.js), so `await api.get('/x')` resolves to the JSON body itself.
// A mock returning `{ data: { items: [] } }` is the PRE-interceptor shape and
// does not exist at any call site.
//
// This mattered on 2026-08-04: services/moderation.js read `res.data.items`
// throughout, so listBlockedUsers / listMyReports / listReportQueue silently
// returned [] forever and isBlocked() always answered false — the Guideline 1.2
// block/report surfaces looked shipped and did nothing. Three test files mocked
// the same wrong shape, so the suite was green the entire time. Right:
//
//   api.get.mockResolvedValue({ items: [ROW] })          // ✅ what api returns
//   api.get.mockResolvedValue({ data: { items: [ROW] } })// ❌ hides the bug
const resolve = () => Promise.resolve({});

const api = {
  get: jest.fn(resolve),
  post: jest.fn(resolve),
  put: jest.fn(resolve),
  patch: jest.fn(resolve),
  delete: jest.fn(resolve),
  defaults: { headers: { common: {} }, baseURL: 'http://test.local' },
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
};

export default api;

// The real module exports the axios instance as a NAMED export too, plus a set
// of helpers that AuthContext and the upload paths call at mount time. Missing
// any of these makes every screen look like it crashes on render.
export { api };
export const BASE_URL = 'http://test.local';
export const setAuthToken = jest.fn();
export const getAuthToken = jest.fn(() => null);
export const getBaseUrl = jest.fn(() => 'http://test.local');
export const setUnauthorizedHandler = jest.fn();
// AuthContext registers this in a mount effect. Leaving it off the mock made
// EVERY screen in the render sweep fail with "setRefreshHandler is not a
// function" — the whole app tree mounts inside AuthProvider.
export const setRefreshHandler = jest.fn();
export const uploadFile = jest.fn(() => Promise.resolve({ url: 'http://test.local/f.jpg' }));

// Mirror the real module's named export so `import { extractMessage }` works.
export function extractMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join(', ');
  }
  return error?.message || 'Something went wrong';
}
