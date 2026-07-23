// Manual mock for the axios-based api client.
//
// Screen tests that render a component which fetches on mount should enable
// this with `jest.mock('<path>/services/api')` at the top of the file, then
// override per-test:  api.get.mockResolvedValueOnce({ ... }).
//
// Every method resolves empty by default so a screen mounts without hitting
// the network and without a dangling promise. `extractMessage` keeps its real
// shape because components render its output directly.
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

// Mirror the real module's named export so `import { extractMessage }` works.
export function extractMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join(', ');
  }
  return error?.message || 'Something went wrong';
}
