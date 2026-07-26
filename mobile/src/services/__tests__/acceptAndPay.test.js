// acceptAndPay.test.js — founder ruling 2026-07-25:
// "the client should get charged the moment they click accept".
//
// What is pinned here, in order of how badly it would hurt to lose it:
//
//   1. ORDERING — the booking is created BEFORE any payment sheet is presented.
//      Presenting a sheet with nothing to charge against is the failure mode the
//      whole module exists to prevent.
//   2. NO SILENT UNPAID BOOKING — every outcome that is not "paid" is REPORTED,
//      with the booking id, so the screen can say so out loud.
//   3. THE FALLBACK RULE — hosted Checkout opens only when the native sheet
//      genuinely cannot run. A decline or a cancel must never open a browser.
//   4. THE ACCEPT IS NOT REPEATABLE — a retry after a decline charges the same
//      booking instead of re-POSTing an accept that would 400.

import { Linking } from 'react-native';

jest.mock('../api', () => ({
  api: { post: jest.fn(), patch: jest.fn() },
}));

// The real nativePay is exercised by its own suite. Here it is a seam: what
// matters is which of its documented outcomes maps to which of ours.
jest.mock('../nativePay', () => ({
  payForBookingNatively: jest.fn(),
  isAlreadyPaidError: (err) => /already_paid/i.test((err && err.message) || ''),
}));

// eslint-disable-next-line import/first
import { api } from '../api';
// eslint-disable-next-line import/first
import { payForBookingNatively } from '../nativePay';
// eslint-disable-next-line import/first
import {
  acceptQuoteAndPay,
  AcceptedButUnpaidError,
  ACCEPT_CANCELLED,
  ACCEPT_CHECKOUT,
  ACCEPT_PAID,
} from '../acceptAndPay';

const PAID = { paymentIntentId: 'pi_1', amountCents: 20400 };

function cancelled() {
  const e = new Error('cancelled');
  e.cancelled = true;
  return e;
}

function unavailable() {
  const e = new Error('This build cannot show the in-app payment sheet.');
  e.nativePayUnavailable = true;
  return e;
}

/** The accept response the backend actually returns (see api/interests.py). */
function acceptResponse({ bookingId = 'bk_1', checkoutUrl = null } = {}) {
  return {
    message: 'Interest accepted — booking and payment created',
    booking: { id: bookingId },
    checkout_url: checkoutUrl,
    payment_started: !!checkoutUrl,
  };
}

let openURL;

beforeEach(() => {
  jest.clearAllMocks();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  api.patch.mockResolvedValue(acceptResponse());
});

afterEach(() => {
  openURL.mockRestore();
});

// ─── 1 · Ordering ────────────────────────────────────────────────────────────

describe('the booking exists before any sheet is presented', () => {
  it('accepts first, then charges that booking', async () => {
    payForBookingNatively.mockResolvedValue(PAID);

    const result = await acceptQuoteAndPay({ interestId: 'int_1' });

    expect(api.patch).toHaveBeenCalledWith('/interests/int_1/accept');
    expect(payForBookingNatively).toHaveBeenCalledWith({
      bookingId: 'bk_1',
      email: undefined,
    });
    expect(result).toEqual({ outcome: ACCEPT_PAID, bookingId: 'bk_1', paid: PAID });
  });

  it('never presents a sheet it cannot charge against', async () => {
    // The accept resolved, but with no booking. Charging is impossible, so the
    // sheet must not open at all.
    api.patch.mockResolvedValue({ message: 'accepted', booking: null });

    await expect(acceptQuoteAndPay({ interestId: 'int_1' })).rejects.toThrow();
    expect(payForBookingNatively).not.toHaveBeenCalled();
  });

  it('does not accept a quote it was not given', async () => {
    await expect(acceptQuoteAndPay({})).rejects.toThrow();
    expect(api.patch).not.toHaveBeenCalled();
    expect(payForBookingNatively).not.toHaveBeenCalled();
  });

  it('a failed accept creates nothing and charges nothing', async () => {
    api.patch.mockRejectedValue(new Error('Interest is not pending'));

    await expect(acceptQuoteAndPay({ interestId: 'int_1' })).rejects.toThrow(
      'Interest is not pending',
    );
    expect(payForBookingNatively).not.toHaveBeenCalled();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('hands the booking id back the instant it exists, before charging', async () => {
    // onAccepted is the caller's ONLY reliable notice that a booking is now on
    // the hook, so it must fire even when the charge then goes wrong.
    const seen = [];
    payForBookingNatively.mockImplementation(async () => {
      seen.push('charge');
      throw cancelled();
    });

    await acceptQuoteAndPay({
      interestId: 'int_1',
      onAccepted: (a) => seen.push(`accepted:${a.bookingId}`),
    });

    expect(seen).toEqual(['accepted:bk_1', 'charge']);
  });
});

// ─── 2 · The dismissed sheet ─────────────────────────────────────────────────

describe('the client dismisses the payment sheet', () => {
  it('reports it as a cancel, with the booking that was left behind', async () => {
    payForBookingNatively.mockRejectedValue(cancelled());

    const result = await acceptQuoteAndPay({ interestId: 'int_1' });

    // Not an exception: dismissing is a choice, not a failure. But it IS
    // reported, and it carries the booking id — the screen has everything it
    // needs to say "not paid yet" and route the client to pay.
    expect(result).toEqual({ outcome: ACCEPT_CANCELLED, bookingId: 'bk_1' });
  });

  it('does not bounce a cancelling client into a browser', async () => {
    payForBookingNatively.mockRejectedValue(cancelled());

    await acceptQuoteAndPay({ interestId: 'int_1' });

    expect(openURL).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('retrying after a cancel charges the SAME booking, it does not re-accept', async () => {
    payForBookingNatively.mockRejectedValueOnce(cancelled());
    const first = await acceptQuoteAndPay({ interestId: 'int_1' });
    expect(api.patch).toHaveBeenCalledTimes(1);

    payForBookingNatively.mockResolvedValueOnce(PAID);
    const second = await acceptQuoteAndPay({
      interestId: 'int_1',
      accepted: { bookingId: first.bookingId },
    });

    // A second PATCH would 400 "Interest is not pending" and the client would
    // see that instead of their real card error.
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(second.outcome).toBe(ACCEPT_PAID);
    expect(payForBookingNatively).toHaveBeenLastCalledWith({
      bookingId: 'bk_1',
      email: undefined,
    });
  });
});

// ─── 3 · The fallback rule ───────────────────────────────────────────────────

describe('hosted Checkout is the fallback, never the default', () => {
  it('is not used when the native sheet works', async () => {
    payForBookingNatively.mockResolvedValue(PAID);

    await acceptQuoteAndPay({ interestId: 'int_1' });

    expect(openURL).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('opens only when the native sheet genuinely cannot run', async () => {
    payForBookingNatively.mockRejectedValue(unavailable());
    api.patch.mockResolvedValue(
      acceptResponse({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    );

    const result = await acceptQuoteAndPay({ interestId: 'int_1' });

    expect(result).toEqual({ outcome: ACCEPT_CHECKOUT, bookingId: 'bk_1' });
    expect(openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
    // The backend's accept trigger already opened a session — reuse it rather
    // than minting a second one against the same booking.
    expect(api.post).not.toHaveBeenCalled();
  });

  it('asks the backend for a session when the accept did not supply one', async () => {
    payForBookingNatively.mockRejectedValue(unavailable());
    api.post.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/x' });

    const result = await acceptQuoteAndPay({ interestId: 'int_1' });

    expect(api.post).toHaveBeenCalledWith('/payments/stripe/checkout/bk_1', {});
    expect(openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/x');
    expect(result.outcome).toBe(ACCEPT_CHECKOUT);
  });

  it('reports honestly when even the fallback cannot start', async () => {
    payForBookingNatively.mockRejectedValue(unavailable());
    api.post.mockRejectedValue(new Error('Stripe is not configured'));

    const err = await acceptQuoteAndPay({ interestId: 'int_1' }).catch((e) => e);

    expect(err).toBeInstanceOf(AcceptedButUnpaidError);
    expect(err.bookingId).toBe('bk_1');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('a DECLINE never opens a browser', async () => {
    // The M9 bug, reintroduced as an error path: bouncing a declined client to
    // a hosted page at the exact moment they cannot tell a bug from a refusal.
    payForBookingNatively.mockRejectedValue(new Error('Your card was declined.'));

    const err = await acceptQuoteAndPay({ interestId: 'int_1' }).catch((e) => e);

    expect(err).toBeInstanceOf(AcceptedButUnpaidError);
    expect(err.message).toBe('Your card was declined.');
    expect(err.bookingId).toBe('bk_1');
    expect(err.acceptedButUnpaid).toBe(true);
    expect(openURL).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});

// ─── 4 · Double-charge safety ────────────────────────────────────────────────

describe('a booking that is already paid', () => {
  it("treats the server's already_paid refusal as the success it is", async () => {
    // A retry that raced the first charge's server-side settle. The client has
    // paid; showing them an error, or charging again, are both wrong.
    payForBookingNatively.mockRejectedValue(
      new Error('already_paid: this booking has already been paid.'),
    );

    const result = await acceptQuoteAndPay({
      interestId: 'int_1',
      accepted: { bookingId: 'bk_1' },
    });

    expect(result).toEqual({ outcome: ACCEPT_PAID, bookingId: 'bk_1', paid: null });
    expect(openURL).not.toHaveBeenCalled();
  });
});

// ─── 5 · Billing details ─────────────────────────────────────────────────────

describe('the client’s email', () => {
  it('is passed through to pre-fill the sheet when the screen has it', async () => {
    payForBookingNatively.mockResolvedValue(PAID);

    await acceptQuoteAndPay({ interestId: 'int_1', email: 'jane@example.com' });

    expect(payForBookingNatively).toHaveBeenCalledWith({
      bookingId: 'bk_1',
      email: 'jane@example.com',
    });
  });
});
