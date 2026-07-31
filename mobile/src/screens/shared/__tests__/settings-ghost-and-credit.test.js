// Two endpoints that existed with no way in.
//
// POST /me/ghost, POST /me/unghost and GET /me/credits were built, merged, and
// called by nothing — found by sweeping all 127 backend routes against every
// mobile source file on 2026-07-31.
//
// Ghost mode is the worse of the two: PrivacyPolicyScreen §3 tells the user, in
// a legal document, that "the app also offers a reversible ghost mode". App
// Review reads the privacy policy. Describing a control the app does not expose
// is exactly the sort of mismatch that gets found there rather than here.
//
// A credit is money owed to someone a business already let down once (granted
// on a late cancellation or a no-show). Not being able to see it is the second
// letdown.

import React from 'react';
import { fireEvent, waitFor, act } from '@testing-library/react-native';

import { renderScreen } from '../../../test-utils/renderWithProviders';
import i18n from '../../../i18n';

jest.mock('../../../services/api');

const mockToast = jest.fn();
jest.mock('../../../services/toast', () => ({ show: (...a) => mockToast(...a) }));

const mockUser = { id: 'u1', role: 'client', first_name: 'Kira', is_ghosted: false };
jest.mock('../../../context/AuthContext', () => {
  const actual = jest.requireActual('../../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      token: 't',
      isLoading: false,
      logout: jest.fn(),
      updateUser: jest.fn(),
    }),
  };
});

// eslint-disable-next-line import/first
import { api } from '../../../services/api';
// eslint-disable-next-line import/first
import SettingsScreen from '../SettingsScreen';

// SettingsScreen calls useNavigation(), so it needs a real NavigationContainer
// around it — that is what renderScreen provides.
function mount() {
  return renderScreen(<SettingsScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.is_ghosted = false;
  api.get.mockResolvedValue({ balance_cents: 0 });
  api.post.mockResolvedValue({ message: 'ghost_mode_on', is_ghosted: true });
});

describe('ghost mode is reachable', () => {
  it('offers the control the privacy policy promises', async () => {
    const utils = mount();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('settings.ghostMode'))).toBeTruthy(),
    );
  });

  it('calls the endpoint that had no caller', async () => {
    const utils = mount();
    const toggle = await waitFor(() =>
      utils.getByLabelText(i18n.t('settings.ghostMode')),
    );

    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    expect(api.post).toHaveBeenCalledWith('/me/ghost', {});
  });

  it('turns it back off through /me/unghost', async () => {
    mockUser.is_ghosted = true;
    const utils = mount();
    const toggle = await waitFor(() =>
      utils.getByLabelText(i18n.t('settings.ghostMode')),
    );

    await act(async () => {
      fireEvent(toggle, 'valueChange', false);
    });

    expect(api.post).toHaveBeenCalledWith('/me/unghost', {});
  });

  it('repeats the 409 reasons instead of a generic failure', async () => {
    // "You have an active booking" is actionable. "Could not" is not.
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: { reasons: ['You have an active booking'] } },
      },
    });

    const utils = mount();
    const toggle = await waitFor(() =>
      utils.getByLabelText(i18n.t('settings.ghostMode')),
    );
    await act(async () => {
      fireEvent(toggle, 'valueChange', true);
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ text2: 'You have an active booking' }),
      ),
    );
  });
});

describe('credit balance is visible', () => {
  it('shows a balance that was previously invisible', async () => {
    api.get.mockImplementation((path) =>
      path === '/me/credits'
        ? Promise.resolve({ balance_cents: 2500 })
        : Promise.resolve({}),
    );

    const utils = mount();
    await waitFor(() => expect(utils.getByText('$25.00')).toBeTruthy());
  });

  it('shows no credit row at all when there is none', async () => {
    // Never "$0.00" — an empty balance is not news, and a zero on a money row
    // reads like something was lost.
    const utils = mount();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('settings.ghostMode'))).toBeTruthy(),
    );
    expect(utils.queryByText(i18n.t('settings.credit'))).toBeNull();
  });

  it('opens fine when the credits call fails', async () => {
    api.get.mockRejectedValue(new Error('down'));
    const utils = mount();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('settings.ghostMode'))).toBeTruthy(),
    );
  });
});
