// App Store Guideline 5.1.1(v) — in-app account deletion.
//
// This flow was BROKEN, not missing: the tap sent `{ confirm }` to a backend
// that required a password, so every attempt 422'd and no account was ever
// deleted. The tests below pin the two shapes the sheet now has, because the
// bug was invisible from the outside — the button existed and looked fine.
//
// The social-only case is the one that matters most: a reviewer tests deletion
// with the Sign in with Apple account they just created, which has no password.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import SettingsScreen from '../SettingsScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

const mockLogout = jest.fn();
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1', role: 'client', email: 'a@b.co' },
    logout: (...args) => mockLogout(...args),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <SettingsScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Open the delete sheet and let the /me/auth-methods round trip settle. */
async function openDeleteSheet(utils, hasPassword) {
  api.get.mockImplementation((url) => {
    if (url === '/me/auth-methods') {
      return Promise.resolve({ data: { has_password: hasPassword } });
    }
    return Promise.resolve({ data: {} });
  });
  await act(async () => {
    fireEvent.press(utils.getByText(i18n.t('settings.deleteAccount')));
  });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: { message: 'account_deactivated' } });
});

describe('delete account', () => {
  it('deletes a social-only account with no password', async () => {
    const utils = renderScreen();
    await openDeleteSheet(utils, false);

    // No password field: there is no password to ask for, and asking anyway is
    // what made this unusable for a Sign in with Apple account.
    expect(utils.queryByText(i18n.t('settings.deleteAccountPasswordLabel'))).toBeNull();

    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('settings.deleteAccountConfirm')));
    });

    expect(api.delete).toHaveBeenCalledWith('/me', {
      data: { confirm: 'DELETE_MY_ACCOUNT' },
    });
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it('sends the password for a password account', async () => {
    const utils = renderScreen();
    await openDeleteSheet(utils, true);

    const field = utils.getByPlaceholderText(
      i18n.t('settings.deleteAccountPasswordHint'),
    );
    fireEvent.changeText(field, 'hunter2');

    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('settings.deleteAccountConfirm')));
    });

    expect(api.delete).toHaveBeenCalledWith('/me', {
      data: { confirm: 'DELETE_MY_ACCOUNT', password: 'hunter2' },
    });
  });

  it('will not submit a password account with an empty password', async () => {
    const utils = renderScreen();
    await openDeleteSheet(utils, true);

    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('settings.deleteAccountConfirm')));
    });

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('says the password was wrong on a 401, and stays open', async () => {
    api.delete.mockRejectedValue({ response: { status: 401 } });

    const utils = renderScreen();
    await openDeleteSheet(utils, true);
    fireEvent.changeText(
      utils.getByPlaceholderText(i18n.t('settings.deleteAccountPasswordHint')),
      'wrong',
    );
    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('settings.deleteAccountConfirm')));
    });

    await waitFor(() => {
      expect(
        utils.getByText(i18n.t('settings.deleteAccountWrongPassword')),
      ).toBeTruthy();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('asks for a password when /me/auth-methods fails', async () => {
    // Fail closed, matching me.py::_has_password_identity. A lookup outage must
    // never quietly drop the re-authentication gate.
    api.get.mockRejectedValue(new Error('offline'));

    const utils = renderScreen();
    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('settings.deleteAccount')));
    });

    await waitFor(() => {
      expect(
        utils.getByText(i18n.t('settings.deleteAccountPasswordLabel')),
      ).toBeTruthy();
    });
  });
});
