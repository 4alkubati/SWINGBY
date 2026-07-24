// social-auth.test.js — unit tests for the Google/Apple client service.
//
// The native modules (expo-web-browser, expo-linking, expo-apple-authentication,
// expo-crypto) and the backend are all mocked. What this proves is OUR glue:
// the PKCE handshake is driven in the right order, the auth code is pulled out
// of the redirect URL, both tokens are persisted, and the profile is returned.
// A real Google/Apple round trip is NOT and cannot be exercised here — see the
// NOT VERIFIED section of the AUTH report.

jest.mock('expo-linking', () => ({
  createURL: (path) => `swingby://${path}`,
}));

const mockOpenAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args) => mockOpenAuthSession(...args),
}));

const mockApiPost = jest.fn();
const mockSetAuthToken = jest.fn();
jest.mock('../services/api', () => ({
  api: { post: (...a) => mockApiPost(...a) },
  setAuthToken: (...a) => mockSetAuthToken(...a),
}));

const mockSetItem = jest.fn();
jest.mock('../services/storage', () => ({
  setItemAsync: (...a) => mockSetItem(...a),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockGetMe = jest.fn();
jest.mock('../services/auth', () => ({
  getMe: (...a) => mockGetMe(...a),
}));

import {
  signInWithGoogle,
  signInWithIdToken,
  getRedirectUri,
} from '../services/socialAuth';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signInWithGoogle', () => {
  function wireHappyPath() {
    mockApiPost.mockImplementation((url) => {
      if (url === '/auth/social/authorize') {
        return Promise.resolve({
          url: 'https://x.supabase.co/auth/v1/authorize?provider=google',
          code_verifier: 'the-verifier',
        });
      }
      if (url === '/auth/social/exchange') {
        return Promise.resolve({
          access_token: 'acc',
          refresh_token: 'ref',
          is_new_user: true,
          role: 'client',
        });
      }
      return Promise.resolve({});
    });
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'swingby://auth-callback?code=THE_CODE',
    });
    mockGetMe.mockResolvedValue({ id: 'u1', role: 'client', first_name: 'Ada' });
  }

  it('runs authorize -> browser -> exchange and returns the profile', async () => {
    wireHappyPath();
    const result = await signInWithGoogle({ role: 'business_owner' });

    // Step 1: authorize with the app's redirect URI + role.
    expect(mockApiPost).toHaveBeenCalledWith('/auth/social/authorize', {
      provider: 'google',
      redirect_to: 'swingby://auth-callback',
      role: 'business_owner',
    });
    // Step 2: browser opened with the returned URL and same redirect.
    expect(mockOpenAuthSession).toHaveBeenCalledWith(
      'https://x.supabase.co/auth/v1/authorize?provider=google',
      'swingby://auth-callback',
    );
    // Step 3: exchange with the code parsed out of the redirect + the verifier.
    expect(mockApiPost).toHaveBeenCalledWith('/auth/social/exchange', {
      code: 'THE_CODE',
      code_verifier: 'the-verifier',
      provider: 'google',
      role: 'business_owner',
    });
    // Tokens persisted (both keys) and set live on the client.
    expect(mockSetItem).toHaveBeenCalledWith('swingby_token', 'acc');
    expect(mockSetItem).toHaveBeenCalledWith('swingby_refresh_token', 'ref');
    expect(mockSetAuthToken).toHaveBeenCalledWith('acc');
    expect(result.profile).toEqual({ id: 'u1', role: 'client', first_name: 'Ada' });
    expect(result.isNewUser).toBe(true);
  });

  it('throws a cancelled error when the user dismisses the browser', async () => {
    wireHappyPath();
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'cancelled' });
    // No exchange, no token write on cancel.
    expect(mockApiPost).not.toHaveBeenCalledWith(
      '/auth/social/exchange',
      expect.anything(),
    );
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('errors clearly when the redirect carries no code', async () => {
    wireHappyPath();
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'swingby://auth-callback?error=access_denied',
    });
    await expect(signInWithGoogle()).rejects.toThrow(/authorization code/i);
  });
});

describe('signInWithIdToken (Apple / native Google tail)', () => {
  it('posts the id_token + nonce and stores the session', async () => {
    mockApiPost.mockResolvedValue({
      access_token: 'acc2',
      refresh_token: 'ref2',
      is_new_user: false,
      role: 'client',
    });
    mockGetMe.mockResolvedValue({ id: 'u2' });

    const result = await signInWithIdToken({
      provider: 'apple',
      idToken: 'apple.jwt',
      nonce: 'raw-nonce',
      firstName: 'Tim',
      lastName: 'Apple',
    });

    expect(mockApiPost).toHaveBeenCalledWith('/auth/social/id-token', {
      provider: 'apple',
      id_token: 'apple.jwt',
      nonce: 'raw-nonce',
      first_name: 'Tim',
      last_name: 'Apple',
      role: undefined,
    });
    expect(mockSetItem).toHaveBeenCalledWith('swingby_token', 'acc2');
    expect(result.profile).toEqual({ id: 'u2' });
  });
});

describe('getRedirectUri', () => {
  it('builds the app-scheme callback URL', () => {
    expect(getRedirectUri()).toBe('swingby://auth-callback');
  });
});
