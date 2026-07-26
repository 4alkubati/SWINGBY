// accept-charges-now.test.js — founder ruling 2026-07-25, at the screen.
//
// services/__tests__/acceptAndPay.test.js pins the ordering and the outcomes.
// This suite pins that QuoteComparisonScreen is actually WIRED to them, and in
// particular the thing that has no other guard:
//
//   the client accepts, a booking is created, and then they dismiss the payment
//   sheet — and the screen must not let that booking disappear quietly.
//
// It also proves the busier accept path no longer bounces the client into a
// browser, which was the whole complaint (M9 / walkthrough audit 2026-07-24).

import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';

jest.mock('../../../services/api');
jest.mock('../../../services/nativePay', () => ({
  payForBookingNatively: jest.fn(),
  isNativePaySupported: () => true,
  isAlreadyPaidError: (err) => /already_paid/i.test((err && err.message) || ''),
  PaymentCancelledError: class PaymentCancelledError extends Error {},
}));
jest.mock('../../../services/toast', () => ({
  ...jest.requireActual('../../../services/toast'),
  show: jest.fn(),
}));

// eslint-disable-next-line import/first
import api from '../../../services/api';
// eslint-disable-next-line import/first
import { payForBookingNatively } from '../../../services/nativePay';
// eslint-disable-next-line import/first
import * as toast from '../../../services/toast';
// eslint-disable-next-line import/first
import QuoteComparisonScreen from '../QuoteComparisonScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const QUOTE = {
  id: 'int_1',
  quoted_price: 204,
  status: 'pending',
  businesses: { business_name: 'Test Cleaning Co.', avg_rating: 4.8 },
};

const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true,
};
const mockRoute = { params: { postId: 'p1', postTitle: 'Deep clean' } };

function Providers({ children }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

let openURL;

beforeEach(() => {
  jest.clearAllMocks();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  api.get.mockResolvedValue([QUOTE]);
  api.patch.mockResolvedValue({ booking: { id: 'bk_1' }, checkout_url: null });
  api.post.mockResolvedValue({});
});

afterEach(() => {
  openURL.mockRestore();
});

// The CTA renders its bare verb while the sheet is still pricing and only gains
// the figure once the quote lands — which is also when it stops being disabled.
// Anchoring on the PRICED label is therefore the wait for "the CTA is live";
// matching /Confirm & pay/ would find the disabled one and press nothing.
const PRICED_CTA = 'Confirm & pay $204';

/** Render, open the pay sheet on the one quote, and press its CTA. */
async function acceptAndConfirm() {
  const utils = render(
    <Providers>
      <QuoteComparisonScreen navigation={mockNavigation} route={mockRoute} />
    </Providers>,
  );

  const accept = await utils.findByText('Accept & pay', {}, { timeout: 5000 });
  fireEvent.press(accept);

  const cta = await utils.findByText(PRICED_CTA, {}, { timeout: 5000 });
  fireEvent.press(cta);

  return utils;
}

describe('accepting a quote charges in-app, immediately', () => {
  it('creates the booking then presents the native sheet — no browser', async () => {
    payForBookingNatively.mockResolvedValue({
      paymentIntentId: 'pi_1',
      amountCents: 20400,
    });

    await acceptAndConfirm();

    await waitFor(() => expect(payForBookingNatively).toHaveBeenCalled());
    expect(api.patch).toHaveBeenCalledWith('/interests/int_1/accept');
    expect(payForBookingNatively).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'bk_1' }),
    );

    // The M9 complaint: this path used to end in Linking.openURL.
    expect(openURL).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(
        'Chat',
        expect.objectContaining({ bookingId: 'bk_1' }),
      ),
    );
  });
});

describe('the client dismisses the payment sheet after the booking was created', () => {
  it('does not leave the unpaid booking behind silently', async () => {
    const cancel = new Error('cancelled');
    cancel.cancelled = true;
    payForBookingNatively.mockRejectedValue(cancel);

    const utils = await acceptAndConfirm();

    // The booking now exists and is unpaid. Our sheet deliberately stays open
    // so retrying is one tap...
    await waitFor(() => expect(payForBookingNatively).toHaveBeenCalled());
    expect(toast.show).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();

    // ...but if they walk away from that too, the screen must SAY so.
    fireEvent.press(utils.getByLabelText('Cancel'));

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', text1: 'Not paid yet' }),
      ),
    );

    // ...and land them where paying is a single tap.
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith('BookingDetails', {
        bookingId: 'bk_1',
      }),
    );
  });

  it('a retry after the dismissal does not accept the quote twice', async () => {
    const cancel = new Error('cancelled');
    cancel.cancelled = true;
    payForBookingNatively.mockRejectedValueOnce(cancel);

    const utils = await acceptAndConfirm();
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));

    // Sheet is still open. Pay again — PATCH /interests/{id}/accept would 400
    // "Interest is not pending", so it must not run a second time.
    payForBookingNatively.mockResolvedValueOnce({
      paymentIntentId: 'pi_1',
      amountCents: 20400,
    });
    fireEvent.press(utils.getByText(PRICED_CTA));

    await waitFor(() => expect(payForBookingNatively).toHaveBeenCalledTimes(2));
    expect(api.patch).toHaveBeenCalledTimes(1);
  });
});

describe('closing the sheet before accepting anything', () => {
  it('is silent — nothing was created, so there is nothing to report', async () => {
    const utils = render(
      <Providers>
        <QuoteComparisonScreen navigation={mockNavigation} route={mockRoute} />
      </Providers>,
    );

    const accept = await utils.findByText('Accept & pay', {}, { timeout: 5000 });
    fireEvent.press(accept);
    await utils.findByText(PRICED_CTA, {}, { timeout: 5000 });

    fireEvent.press(utils.getByLabelText('Cancel'));

    expect(api.patch).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});
