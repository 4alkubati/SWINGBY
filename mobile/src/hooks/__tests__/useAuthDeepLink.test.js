// useAuthDeepLink.test.js — F003 regression.
//
// The bug: this hook was mounted unconditionally in RootNavigator and ran
// completeAuthFromUrl() whether or not a user was already logged in. That
// service writes to the SAME SecureStore keys the live session uses, so a
// stale/foreign auth-callback link tapped by an already-signed-in user could
// silently overwrite or (on a rejected token) delete their working session —
// invisible until the next cold boot or token refresh.
//
// This proves the guard at the call site: completeAuthFromUrl must never be
// invoked while `alreadyLoggedIn` is true. The restore-on-failure half of the
// fix (belt-and-braces, inside completeAuthFromUrl itself) is covered
// separately in services/__tests__/authLink.test.js.

let mockUrl = null;
jest.mock('expo-linking', () => ({
  useURL: () => mockUrl,
}));

const mockComplete = jest.fn();
jest.mock('../../services/authLink', () => ({
  completeAuthFromUrl: (...args) => mockComplete(...args),
}));

jest.mock('../../services/toast', () => ({
  show: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthDeepLink } from '../useAuthDeepLink';

beforeEach(() => {
  jest.clearAllMocks();
  mockUrl = null;
});

describe('the already-logged-in guard (F003)', () => {
  it('never touches the session for a link that arrives while one is already live', async () => {
    mockUrl = 'swingby://auth-callback#access_token=FOREIGN';
    const onSession = jest.fn();

    renderHook(() => useAuthDeepLink(onSession, /* alreadyLoggedIn */ true));

    // Give any (wrongly-fired) async work a turn, then assert it never ran.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockComplete).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
  });

  it('still processes a real auth link normally when logged out', async () => {
    mockUrl = 'swingby://auth-callback#access_token=REAL';
    mockComplete.mockResolvedValue({
      profile: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'REAL',
    });
    const onSession = jest.fn();

    renderHook(() => useAuthDeepLink(onSession, /* alreadyLoggedIn */ false));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith(mockUrl));
    await waitFor(() =>
      expect(onSession).toHaveBeenCalledWith({ id: 'u1', email: 'jane@example.com' }, 'REAL')
    );
  });
});
