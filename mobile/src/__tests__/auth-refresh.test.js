// Session-expiry regression suite.
//
// The bug: a Supabase access token dies after ~1h and the mobile 401 handler
// logged the user straight out, so every session silently ended mid-use and
// dumped the user back at the login screen.
//
// The fix (services/api.js): on a 401, refresh the token ONCE, replay the
// original request, and only log out if the refresh itself fails.
//
// These tests drive the REAL axios instance and its REAL interceptor chain —
// only the transport at the bottom is swapped for a scripted adapter, so the
// retry interceptor, the refresh interceptor and the unwrap interceptor all
// execute exactly as they do in the app.

jest.mock('../services/toast', () => ({ show: jest.fn() }));

/** Load a pristine copy of services/api (module-level _refreshInFlight etc.). */
function freshApi() {
  let mod;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('../services/api');
  });
  return mod;
}

/**
 * Replace the HTTP transport with a scripted handler.
 * handler(config) -> { status, data }
 */
function installAdapter(api, handler) {
  api.defaults.adapter = async (config) => {
    const scripted = await handler(config);
    const response = {
      data: scripted.data,
      status: scripted.status,
      statusText: '',
      headers: {},
      config,
      request: {},
    };
    if (scripted.status >= 200 && scripted.status < 300) return response;
    const err = new Error(`Request failed with status code ${scripted.status}`);
    err.isAxiosError = true;
    err.config = config;
    err.response = response;
    throw err;
  };
}

describe('401 → refresh → replay', () => {
  it('refreshes the expired token, replays the request, and does NOT log out', async () => {
    const { api, setAuthToken, setRefreshHandler, setUnauthorizedHandler } = freshApi();

    const seenAuthHeaders = [];
    installAdapter(api, (config) => {
      seenAuthHeaders.push(config.headers.Authorization);
      // Only the refreshed token is accepted.
      return config.headers.Authorization === 'Bearer NEW'
        ? { status: 200, data: { id: 'booking-1' } }
        : { status: 401, data: { detail: 'Token expired' } };
    });

    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    const refresh = jest.fn(async () => {
      setAuthToken('NEW'); // AuthContext.refresh() does exactly this
      return 'NEW';
    });
    setRefreshHandler(refresh);

    setAuthToken('EXPIRED');

    const body = await api.get('/bookings/booking-1');

    // The caller must receive the response BODY, in the same shape a
    // first-try request returns — not an interceptor wrapper object.
    expect(body).toEqual({ id: 'booking-1' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seenAuthHeaders).toEqual(['Bearer EXPIRED', 'Bearer NEW']);
    // The whole point: the user stays logged in.
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('single-flights a burst of parallel 401s into ONE refresh', async () => {
    // Supabase rotates the refresh token on use, so two concurrent refreshes
    // would leave one caller holding a token the server just invalidated.
    const { api, setAuthToken, setRefreshHandler, setUnauthorizedHandler } = freshApi();

    installAdapter(api, (config) =>
      config.headers.Authorization === 'Bearer NEW'
        ? { status: 200, data: { ok: config.url } }
        : { status: 401, data: { detail: 'Token expired' } }
    );

    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    const refresh = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            setAuthToken('NEW');
            resolve('NEW');
          }, 20);
        })
    );
    setRefreshHandler(refresh);
    setAuthToken('EXPIRED');

    const results = await Promise.all([
      api.get('/a'),
      api.get('/b'),
      api.get('/c'),
      api.get('/d'),
      api.get('/e'),
    ]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.ok)).toEqual(['/a', '/b', '/c', '/d', '/e']);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('logs out (once, no loop) when the refresh token is dead', async () => {
    const { api, setAuthToken, setRefreshHandler, setUnauthorizedHandler } = freshApi();

    let hits = 0;
    installAdapter(api, () => {
      hits += 1;
      return { status: 401, data: { detail: 'Token expired' } };
    });

    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    // Refresh token expired/revoked → refreshSession() resolves null.
    const refresh = jest.fn(async () => null);
    setRefreshHandler(refresh);
    setAuthToken('EXPIRED');

    await expect(api.get('/bookings')).rejects.toThrow('Token expired');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hits).toBe(1); // no replay, no loop
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('never tries to refresh a failed login — that 401 is bad credentials', async () => {
    const { api, setAuthToken, setRefreshHandler, setUnauthorizedHandler } = freshApi();

    installAdapter(api, () => ({ status: 401, data: { detail: 'Invalid credentials' } }));

    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    const refresh = jest.fn(async () => 'NEW');
    setRefreshHandler(refresh);
    setAuthToken(null);

    await expect(
      api.post('/auth/login', { email: 'a@b.c', password: 'nope' })
    ).rejects.toThrow('Invalid credentials');

    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('still logs out when no refresh handler is registered at all', async () => {
    const { api, setAuthToken, setUnauthorizedHandler } = freshApi();

    installAdapter(api, () => ({ status: 401, data: { detail: 'Token expired' } }));
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAuthToken('EXPIRED');

    await expect(api.get('/bookings')).rejects.toThrow('Token expired');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('auth service persists the refresh token', () => {
  it('stores access + refresh on login and clears both on logout', async () => {
    const store = {};
    jest.doMock('../services/storage', () => ({
      setItemAsync: jest.fn(async (k, v) => {
        store[k] = v;
      }),
      getItemAsync: jest.fn(async (k) => store[k] ?? null),
      deleteItemAsync: jest.fn(async (k) => {
        delete store[k];
      }),
    }));
    jest.doMock('../services/api', () => ({
      api: { post: jest.fn(async () => ({ access_token: 'A1', refresh_token: 'R1' })) },
    }));

    let auth;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      auth = require('../services/auth');
    });

    await auth.login('a@b.c', 'pw');
    expect(store.swingby_token).toBe('A1');
    expect(store.swingby_refresh_token).toBe('R1');

    await auth.clearToken();
    expect(store.swingby_token).toBeUndefined();
    expect(store.swingby_refresh_token).toBeUndefined();

    jest.dontMock('../services/storage');
    jest.dontMock('../services/api');
  });

  it('refreshSession() exchanges the stored refresh token for a new access token', async () => {
    const store = { swingby_token: 'OLD', swingby_refresh_token: 'R1' };
    jest.doMock('../services/storage', () => ({
      setItemAsync: jest.fn(async (k, v) => {
        store[k] = v;
      }),
      getItemAsync: jest.fn(async (k) => store[k] ?? null),
      deleteItemAsync: jest.fn(async (k) => {
        delete store[k];
      }),
    }));
    const post = jest.fn(async () => ({ access_token: 'A2', refresh_token: 'R2' }));
    jest.doMock('../services/api', () => ({ api: { post } }));

    let auth;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      auth = require('../services/auth');
    });

    const token = await auth.refreshSession();

    expect(token).toBe('A2');
    expect(post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refresh_token: 'R1' },
      { _silent: true }
    );
    // Supabase rotates the refresh token — the new one must be persisted.
    expect(store.swingby_token).toBe('A2');
    expect(store.swingby_refresh_token).toBe('R2');

    jest.dontMock('../services/storage');
    jest.dontMock('../services/api');
  });

  it('refreshSession() returns null when there is nothing to refresh with', async () => {
    const store = {};
    jest.doMock('../services/storage', () => ({
      setItemAsync: jest.fn(),
      getItemAsync: jest.fn(async (k) => store[k] ?? null),
      deleteItemAsync: jest.fn(),
    }));
    const post = jest.fn();
    jest.doMock('../services/api', () => ({ api: { post } }));

    let auth;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      auth = require('../services/auth');
    });

    expect(await auth.refreshSession()).toBeNull();
    expect(post).not.toHaveBeenCalled();

    jest.dontMock('../services/storage');
    jest.dontMock('../services/api');
  });
});
