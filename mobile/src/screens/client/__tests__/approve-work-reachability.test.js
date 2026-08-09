// approve-work-reachability.test.js — walkthrough bug 6.
//
// On a booking whose payment_state was already 'released', the overflow menu
// still offered "Review work & release payment", and tapping it opened
// ApproveWorkScreen showing "Approving releases $0 to <business>.." — the
// backend correctly refuses the actual release (no money is ever at risk),
// but the control should never have been offered once there was nothing left
// to release.
//
// Two things are pinned here:
//   1. BookingDetailsScreen's overflow menu hides "Review work & release
//      payment" once payment_state.state is 'released', and still offers it
//      for a completed booking whose money has not moved yet.
//   2. The gate is deliberately a HIDE, not a disabled row — see the comment
//      at `paymentReleased` in BookingDetailsScreen.js for why (the
//      EscrowStatus card and the 'View receipt' entry already give a
//      released booking its after-the-fact confirmation).

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import BookingDetailsScreen from '../BookingDetailsScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
// eslint-disable-next-line import/first
import api from '../../../services/api';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'client-1', role: 'client' } }),
}));

const nav = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() };

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function completedBooking(paymentState, paymentStatus) {
  return {
    id: 'bk-1',
    client_id: 'client-1',
    status: 'completed',
    total_amount: 180,
    payment_status: paymentStatus,
    payment_state: paymentState,
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <BookingDetailsScreen navigation={nav} route={{ params: { bookingId: 'bk-1' } }} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BookingDetailsScreen overflow menu — "Review work & release payment"', () => {
  it('is gone once payment_state says the money is already released', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) {
        return Promise.resolve(
          completedBooking(
            { state: 'released', amount_held: 0, amount_released: 180, amount_total: 180 },
            'fully_released',
          ),
        );
      }
      if (path.startsWith('/payments/')) return Promise.resolve({ status: 'fully_released' });
      return Promise.resolve({});
    });

    const utils = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await utils.findByLabelText(i18n.t('booking.moreActionsA11y'));

    fireEvent.press(utils.getByLabelText(i18n.t('booking.moreActionsA11y')));

    expect(utils.queryByText(i18n.t('booking.reviewRelease'))).toBeNull();
    // The menu really opened and a released booking still has somewhere to
    // look — the receipt — so nothing about the release itself is lost.
    expect(utils.queryByText(i18n.t('booking.viewReceipt'))).not.toBeNull();
  });

  it('is still offered on a completed booking whose payment has not released yet', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) {
        return Promise.resolve(
          completedBooking(
            { state: 'held', amount_held: 180, amount_released: 0, amount_total: 180 },
            'held',
          ),
        );
      }
      if (path.startsWith('/payments/')) return Promise.resolve({ status: 'held' });
      return Promise.resolve({});
    });

    const utils = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await utils.findByLabelText(i18n.t('booking.moreActionsA11y'));

    fireEvent.press(utils.getByLabelText(i18n.t('booking.moreActionsA11y')));

    expect(utils.queryByText(i18n.t('booking.reviewRelease'))).not.toBeNull();
  });
});
