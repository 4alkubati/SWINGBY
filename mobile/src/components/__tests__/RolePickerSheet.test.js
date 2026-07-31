// The role pick a social sign-in never offered.
//
// `POST /auth/social/role` existed for weeks with no caller, and `isNewUser` was
// returned by both auth services and consumed by nobody. The result: a trade
// signing in with Apple on a shared iPad landed in the CLIENT app, silently,
// with no signup form to have told them otherwise.
//
// These tests pin the two things that make it safe: it only asks a NEW account,
// and a refusal from the backend must let the person through rather than trap
// them behind a sheet they cannot dismiss.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../theme/ThemeProvider';
import RolePickerSheet from '../RolePickerSheet';
import i18n from '../../i18n';

jest.mock('../../services/api');
import { api } from '../../services/api';

function renderSheet(props = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <RolePickerSheet visible onDone={jest.fn()} {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('RolePickerSheet', () => {
  it('offers both roles', () => {
    const utils = renderSheet();
    expect(utils.getByText(i18n.t('rolePicker.clientTitle'))).toBeTruthy();
    expect(utils.getByText(i18n.t('rolePicker.businessTitle'))).toBeTruthy();
  });

  it('escalates to business_owner through the endpoint that had no caller', async () => {
    api.post.mockResolvedValue({ data: { role: 'business_owner' } });
    const onDone = jest.fn();

    const utils = renderSheet({ onDone });
    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('rolePicker.businessTitle')));
    });

    expect(api.post).toHaveBeenCalledWith('/auth/social/role', {
      role: 'business_owner',
    });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('business_owner'));
  });

  it('lets the user through when the backend refuses (403)', async () => {
    // The window is 24h and one-shot. If it has closed the person is already a
    // client, which is a valid answer — trapping them behind an undismissable
    // sheet would be strictly worse than the bug this fixes.
    api.post.mockRejectedValue({ response: { status: 403 } });
    const onDone = jest.fn();

    const utils = renderSheet({ onDone });
    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('rolePicker.businessTitle')));
    });

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('client'));
  });

  it('keeps the sheet open and explains itself on a real failure', async () => {
    api.post.mockRejectedValue({ response: { status: 500 } });
    const onDone = jest.fn();

    const utils = renderSheet({ onDone });
    await act(async () => {
      fireEvent.press(utils.getByText(i18n.t('rolePicker.businessTitle')));
    });

    await waitFor(() =>
      expect(utils.getByText(i18n.t('rolePicker.failed'))).toBeTruthy(),
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
