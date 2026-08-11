// F128 — the beta-invite code only ever rode along on the email/password
// signup path (SignupScreen already threaded route.params.inviteCode into
// referral_code for handleSignup). handleSocial never read it at all, so a
// tester who followed an invite link and signed up with Apple/Google got the
// referral silently dropped. This pins handleSocial forwarding it as
// referralCode into the social service.
import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';

import { renderScreen } from '../test-utils/renderWithProviders';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const mockSignup = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signup: mockSignup, updateUser: mockUpdateUser }),
}));

const mockGoogle = jest.fn();
jest.mock('../services/socialAuth', () => ({
  signInWithGoogle: (...a) => mockGoogle(...a),
}));

const mockApple = jest.fn();
jest.mock('../services/appleAuth', () => ({
  isAppleAuthAvailable: jest.fn().mockResolvedValue(true),
  signInWithApple: (...a) => mockApple(...a),
}));

jest.mock('../services/notifications', () => ({
  registerForPushAsync: jest.fn().mockResolvedValue(undefined),
}));

import SignupScreen from '../screens/auth/SignupScreen';

function renderSignup(routeParams) {
  return renderScreen(
    <SignupScreen
      navigation={{ navigate: mockNavigate }}
      route={{ params: routeParams }}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogle.mockResolvedValue({ profile: { id: 'u1' }, isNewUser: true });
  mockApple.mockResolvedValue({ profile: { id: 'u1' }, isNewUser: true });
});

describe('F128 — social signup forwards the beta-invite code', () => {
  it('passes inviteCode as referralCode to signInWithGoogle', async () => {
    const { getByLabelText, getByTestId } = renderSignup({ inviteCode: 'FRIEND1' });

    await waitFor(() => expect(getByLabelText('Sign up with Google')).toBeTruthy());
    fireEvent.press(getByTestId('terms-consent-checkbox'));
    await act(async () => {
      fireEvent.press(getByLabelText('Sign up with Google'));
    });

    expect(mockGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ referralCode: 'FRIEND1' }),
    );
  });

  it('passes inviteCode as referralCode to signInWithApple', async () => {
    const { getByLabelText, getByTestId } = renderSignup({ inviteCode: 'FRIEND1' });

    await waitFor(() => expect(getByLabelText('Sign up with Apple')).toBeTruthy());
    fireEvent.press(getByTestId('terms-consent-checkbox'));
    await act(async () => {
      fireEvent.press(getByLabelText('Sign up with Apple'));
    });

    expect(mockApple).toHaveBeenCalledWith(
      expect.objectContaining({ referralCode: 'FRIEND1' }),
    );
  });

  it('never blocks social signup when there is no invite code', async () => {
    const { getByLabelText, getByTestId } = renderSignup(undefined);

    await waitFor(() => expect(getByLabelText('Sign up with Google')).toBeTruthy());
    fireEvent.press(getByTestId('terms-consent-checkbox'));
    await act(async () => {
      fireEvent.press(getByLabelText('Sign up with Google'));
    });

    expect(mockGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ referralCode: undefined }),
    );
  });
});
