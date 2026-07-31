// The client's approval is what releases the money (2026-07-31).
//
// Before this, the BUSINESS released its own escrow by marking the job done, so
// there was nothing for the client to approve and no reason for this control to
// exist. Now it is the single most important thing on a finished booking, which
// is why it is the PRIMARY CTA rather than an overflow item — and why releasing
// confirms first and names the amount.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import BookingDetailsScreen from '../BookingDetailsScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'client-1', role: 'client' } }),
}));

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };

function bookingAwaitingApproval(overrides = {}) {
  return {
    id: 'bk-1',
    client_id: 'client-1',
    status: 'completed',
    total_amount: 180,
    approval_deadline_at: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    payment_state: {
      state: 'held',
      label: 'Held in escrow',
      capture_backed: true,
      amount_held: 180,
      amount_due: 0,
      amount_released: 0,
      amount_total: 180,
    },
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <BookingDetailsScreen navigation={nav} route={{ params: { bookingId: 'bk-1' } }} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockResolvedValue({});
});

describe('client approves finished work', () => {
  it('offers Approve as the primary CTA while the money is held', async () => {
    api.get.mockResolvedValue(bookingAwaitingApproval());
    const utils = renderScreen();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('approval.approveCta'))).toBeTruthy(),
    );
  });

  it('does NOT offer it once the payment is already released', async () => {
    api.get.mockResolvedValue(
      bookingAwaitingApproval({
        approval_deadline_at: null,
        payment_state: { state: 'released', amount_held: 0, amount_released: 180 },
      }),
    );
    const utils = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(utils.queryByText(i18n.t('approval.approveCta'))).toBeNull();
  });

  it('confirms before releasing, and names the amount', async () => {
    api.get.mockResolvedValue(bookingAwaitingApproval());
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const utils = renderScreen();
    await waitFor(() =>
      expect(utils.getByText(i18n.t('approval.approveCta'))).toBeTruthy(),
    );
    fireEvent.press(utils.getByText(i18n.t('approval.approveCta')));

    // Irreversible and it is someone else's payday — never on the first tap.
    expect(spy).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    const [, body] = spy.mock.calls.at(-1);
    expect(body).toContain('$180.00');

    const confirm = spy.mock.calls.at(-1)[2].find((b) => b.onPress);
    await act(async () => {
      await confirm.onPress();
    });
    expect(api.post).toHaveBeenCalledWith('/bookings/bk-1/approve');
    spy.mockRestore();
  });
});
