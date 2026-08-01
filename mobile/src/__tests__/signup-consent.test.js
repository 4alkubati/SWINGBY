// The agreement the signup form never asked for.
//
// SignupScreen had zero mentions of the Terms or the Privacy Policy — no
// checkbox, no link, no passive line. That is an App Store 5.1.1 problem, a
// PIPEDA problem, and a "we cannot say anyone agreed" problem.
//
// What these tests pin is the part that is easy to get wrong: the checkbox sits
// on STEP 0, and step 0 is where Apple and Google sign-up live. A checkbox next
// to "Create Account" on step 2 would look correct in a screenshot and gate
// only the slowest of the three ways to end up with an account.

import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';

import { renderScreen } from '../test-utils/renderWithProviders';
import i18n from '../i18n';

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

function renderSignup() {
  return renderScreen(<SignupScreen navigation={{ navigate: mockNavigate }} />);
}

// TextField puts the same accessibilityLabel on its wrapper Pressable AND on
// the TextInput inside it, so a label query returns two nodes. The one that can
// receive text is the one with onChangeText.
function inputFor(utils, label) {
  const matches = utils.getAllByLabelText(label);
  return (
    matches.find((n) => typeof n.props.onChangeText === 'function') || matches[0]
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogle.mockResolvedValue({ profile: { id: 'u1' }, isNewUser: true });
  mockApple.mockResolvedValue({ profile: { id: 'u1' }, isNewUser: true });
});

describe('signup consent gate', () => {
  it('shows the checkbox and both legal links on the first step', async () => {
    const { getByTestId, getByText } = renderSignup();
    expect(getByTestId('terms-consent-checkbox')).toBeTruthy();
    expect(getByText(i18n.t('auth.agreeTerms'))).toBeTruthy();
    expect(getByText(i18n.t('auth.agreePrivacy'))).toBeTruthy();
  });

  it('blocks the email path until the box is ticked', async () => {
    const utils = renderSignup();

    fireEvent.changeText(inputFor(utils, 'Email'), 'new@swingby.dev');
    fireEvent.press(utils.getByText('Continue'));

    await waitFor(() =>
      expect(utils.getByText(i18n.t('auth.agreeRequired'))).toBeTruthy(),
    );
    // Still on step 0 — the password field belongs to step 1.
    expect(utils.queryAllByLabelText('Password')).toHaveLength(0);
  });

  it('lets the email path through once the box is ticked', async () => {
    const utils = renderSignup();

    fireEvent.changeText(inputFor(utils, 'Email'), 'new@swingby.dev');
    fireEvent.press(utils.getByTestId('terms-consent-checkbox'));
    fireEvent.press(utils.getByText('Continue'));

    await waitFor(() =>
      expect(utils.queryAllByLabelText('Password').length).toBeGreaterThan(0),
    );
  });

  it.each([
    ['Sign up with Apple', () => mockApple],
    ['Sign up with Google', () => mockGoogle],
  ])(
    '%s creates no account while the box is unticked',
    async (label, getFn) => {
      const { getByLabelText, getByText } = renderSignup();

      // The Apple button only mounts after the availability check resolves.
      await waitFor(() => expect(getByLabelText(label)).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByLabelText(label));
      });

      expect(getFn()).not.toHaveBeenCalled();
      expect(getByText(i18n.t('auth.agreeRequired'))).toBeTruthy();
    },
  );

  it('passes the consent through to the social service once ticked', async () => {
    const { getByLabelText, getByTestId } = renderSignup();

    await waitFor(() => expect(getByLabelText('Sign up with Google')).toBeTruthy());
    fireEvent.press(getByTestId('terms-consent-checkbox'));
    await act(async () => {
      fireEvent.press(getByLabelText('Sign up with Google'));
    });

    expect(mockGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ acceptedTerms: true }),
    );
  });

  it('opens the real screens from the links, not nothing', async () => {
    const { getByText } = renderSignup();

    fireEvent.press(getByText(i18n.t('auth.agreeTerms')));
    expect(mockNavigate).toHaveBeenCalledWith('TermsOfService');

    fireEvent.press(getByText(i18n.t('auth.agreePrivacy')));
    expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');
  });
});
