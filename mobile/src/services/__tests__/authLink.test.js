// M2 — an email confirmation tapped from the client's inbox has to land them
// INSIDE the app, signed in.
//
// socialAuth's browser round-trip cannot do this: it only captures a redirect
// while it is holding the browser session open. An email link arrives hours
// later against a cold app, through Linking. Nothing consumed it, so a client
// who had just confirmed their account was still dropped on the login screen
// and made to type a password — which is the bug.
//
// The parsing tests are not padding. Supabase returns the session on the URL
// FRAGMENT for magic links (the shape actually in production — see the
// 2026-07-19 mail) and on the QUERY for PKCE, and an expired link returns
// neither. Reading only one shape means the common case silently does nothing.

jest.mock('../api', () => ({
  setAuthToken: jest.fn(),
  api: { post: jest.fn(), get: jest.fn() },
}));
jest.mock('../storage', () => ({
  setItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('../auth', () => ({ getMe: jest.fn() }));

import { setAuthToken } from '../api';
import * as SecureStore from '../storage';
import { getMe } from '../auth';
import { completeAuthFromUrl, parseAuthCallback } from '../authLink';

const PROFILE = { id: 'u1', email: 'jane@example.com', role: 'client' };

beforeEach(() => jest.clearAllMocks());

describe('reading what Supabase sent back', () => {
  it('finds a session on the fragment — the magic-link shape in production', () => {
    const out = parseAuthCallback(
      'swingby://auth-callback#access_token=ACCESS&refresh_token=REFRESH&token_type=bearer'
    );
    expect(out).toEqual({
      kind: 'session',
      accessToken: 'ACCESS',
      refreshToken: 'REFRESH',
    });
  });

  it('finds a session on the query too', () => {
    const out = parseAuthCallback(
      'https://swingbyy.com/auth/confirm?access_token=ACCESS&refresh_token=REFRESH'
    );
    expect(out.kind).toBe('session');
    expect(out.accessToken).toBe('ACCESS');
  });

  it('survives a link with no refresh token', () => {
    const out = parseAuthCallback('swingby://auth-callback#access_token=ACCESS');
    expect(out).toEqual({
      kind: 'session',
      accessToken: 'ACCESS',
      refreshToken: null,
    });
  });

  it('reports an expired link as an error, not as nothing', () => {
    // The failure that matters: silently returning null here would drop the
    // client on the login screen with no idea their link had expired.
    const out = parseAuthCallback(
      'swingby://auth-callback#error=access_denied&error_description=Email%20link%20is%20invalid%20or%20has%20expired'
    );
    expect(out.kind).toBe('error');
    expect(out.message).toBe('Email link is invalid or has expired');
  });

  it('ignores an ordinary deep link', () => {
    expect(parseAuthCallback('swingby://booking/abc-123')).toBeNull();
    expect(parseAuthCallback('https://swingbyy.com/quotes/post-1')).toBeNull();
    expect(parseAuthCallback(null)).toBeNull();
  });

  it('does not mistake a referral code for an auth code', () => {
    // ReferralScreen is linked as invite/:code. Treating that as an auth
    // callback would throw an error toast over a perfectly good invite link.
    expect(parseAuthCallback('swingby://invite/FRIEND50?code=FRIEND50')).toBeNull();
  });
});

describe('completing the session', () => {
  it('stores both tokens, arms the client, and returns the profile', async () => {
    getMe.mockResolvedValue(PROFILE);

    const out = await completeAuthFromUrl(
      'swingby://auth-callback#access_token=ACCESS&refresh_token=REFRESH'
    );

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('swingby_token', 'ACCESS');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'swingby_refresh_token',
      'REFRESH'
    );
    // Armed BEFORE /auth/me, or that call goes out unauthenticated and 401s.
    expect(setAuthToken).toHaveBeenCalledWith('ACCESS');
    expect(out.profile).toEqual(PROFILE);
  });

  it('leaves an ordinary deep link completely alone', async () => {
    const out = await completeAuthFromUrl('swingby://booking/abc-123');

    expect(out).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(setAuthToken).not.toHaveBeenCalled();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('throws a readable message for an expired link', async () => {
    await expect(
      completeAuthFromUrl(
        'swingby://auth-callback#error_description=Email%20link%20is%20invalid%20or%20has%20expired'
      )
    ).rejects.toThrow('Email link is invalid or has expired');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not leave a half-written session when the token is rejected, and there was nothing before it', async () => {
    // A stored-but-dead token is worse than none: the next cold boot restores
    // it, 401s, and logs the client out mid-session for no visible reason.
    // SecureStore.getItemAsync defaults to null (see the mock above), so this
    // is the "nothing to restore" branch.
    getMe.mockRejectedValue(new Error('401'));

    await expect(
      completeAuthFromUrl('swingby://auth-callback#access_token=STALE')
    ).rejects.toThrow('no longer valid');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('swingby_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('swingby_refresh_token');
    expect(setAuthToken).toHaveBeenLastCalledWith(null);
  });

  // F003 regression — restore-on-failure half. If useAuthDeepLink's guard
  // ever gets bypassed and this runs while a session is already live, a bad
  // link must not be able to destroy it: the client must not be logged out
  // on their next cold boot just because they tapped someone else's mail.
  it('restores the prior session instead of wiping it when a bad link arrives on top of a live one', async () => {
    SecureStore.getItemAsync.mockImplementation(async (key) => {
      if (key === 'swingby_token') return 'LIVE_ACCESS';
      if (key === 'swingby_refresh_token') return 'LIVE_REFRESH';
      return null;
    });
    getMe.mockRejectedValue(new Error('401'));

    await expect(
      completeAuthFromUrl('swingby://auth-callback#access_token=FOREIGN')
    ).rejects.toThrow('no longer valid');

    // The foreign token was written and then must be overwritten back to the
    // live one — never left in place, and never just deleted.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('swingby_token', 'FOREIGN');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('swingby_token', 'LIVE_ACCESS');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'swingby_refresh_token',
      'LIVE_REFRESH'
    );
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('swingby_token');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('swingby_refresh_token');
    // The axios client must end up armed with the restored token, not null —
    // otherwise the live session looks fine in SecureStore but every request
    // in flight right now is suddenly unauthenticated.
    expect(setAuthToken).toHaveBeenLastCalledWith('LIVE_ACCESS');
  });

  it('says where to open a PKCE link rather than failing an exchange', async () => {
    await expect(
      completeAuthFromUrl('swingby://auth-callback?code=PKCE_CODE')
    ).rejects.toThrow('device where you started signing in');
    expect(getMe).not.toHaveBeenCalled();
  });
});
