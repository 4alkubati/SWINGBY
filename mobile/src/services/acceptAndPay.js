// acceptAndPay.js — "the client should get charged the moment they click accept."
//
// Founder ruling, 2026-07-25. PAYMENTS.md §S2(c) already said it ("client agrees
// → client pays then") and Path B already said "charge-then-accept ordering",
// but the two accept-a-quote surfaces — QuoteComparisonScreen and the in-thread
// ChatQuoteCard — still finished by handing the client a hosted Checkout URL and
// calling Linking.openURL. That is the busier of the two payment paths and it is
// the one that bounced the client into Chrome (M9, walkthrough audit).
//
// WHY THIS MODULE EXISTS AT ALL
// PaySheet can drive the native sheet itself, but only for a caller that already
// HAS a booking to charge against (BookingDetailsScreen). Accepting a quote does
// not: the booking is minted by PATCH /interests/{id}/accept, which runs inside
// the confirm handler. So the ordering has to live somewhere that can do both
// halves in sequence, and it has to be ONE implementation — two screens hand-
// rolling "accept, then charge, then decide what a cancel means" is how the two
// paths drift apart.
//
// THE ORDERING, AND WHY IT IS THIS WAY ROUND
//   1. accept  → the server creates the booking + its pending_payment ledger row
//   2. charge  → the native Stripe Payment Sheet, against that booking id
// Never the reverse, and never a sheet presented before step 1 resolves: there
// is nothing to charge against until the booking exists, and presenting a sheet
// you cannot charge is how a client ends up typing a card into a dialog that
// then fails for reasons that are not theirs.
//
// The accept is NOT retried per attempt. `PATCH /interests/{id}/accept` 400s
// with "Interest is not pending" the second time, so a client who gets declined
// and taps the CTA again would see that instead of their real card error. The
// caller keeps the booking id from the first accept (`onAccepted`) and hands it
// back as `accepted` — from then on this only charges.
//
// WHAT A CANCELLED SHEET MEANS
// Nothing here rolls the accept back. Once the server has accepted, it has also
// rejected every rival quote on that post and moved the post to `matched`, and
// there is no safe way to un-ring that bell from the client (restoring the other
// interests would resurrect quotes the client had explicitly declined earlier).
// So a dismissed sheet leaves a real, unpaid booking — and the ONE thing this
// module guarantees is that it never leaves it SILENTLY. `outcome` is always
// reported honestly, and the calling screens turn a non-'paid' outcome into
// visible copy plus a route to the screen where paying is one tap away.

import { Linking } from 'react-native';

import { api } from './api';
import { isAlreadyPaidError, payForBookingNatively } from './nativePay';
import i18n from '../i18n';

/** The money is in. Booking is paid. */
export const ACCEPT_PAID = 'paid';
/** The client dismissed Stripe's sheet. Booking exists, unpaid. Not an error. */
export const ACCEPT_CANCELLED = 'cancelled';
/** No native sheet in this build — hosted Checkout opened in the browser. */
export const ACCEPT_CHECKOUT = 'checkout';

/**
 * The accept went through but the charge did not, for a reason worth showing.
 *
 * Carries `bookingId` so a caller that somehow missed the `onAccepted` callback
 * can still find the booking it left behind. PaySheet renders `.message` on its
 * declined chip and re-enables the CTA, which is exactly right for a decline —
 * the client is still in the flow and retrying only re-charges.
 */
export class AcceptedButUnpaidError extends Error {
  constructor(message, bookingId) {
    super(message || i18n.t('quotes.payFailed'));
    this.name = 'AcceptedButUnpaidError';
    this.bookingId = bookingId;
    this.acceptedButUnpaid = true;
  }
}

/**
 * Accept a quote and charge for it, in that order, in-app.
 *
 * @param {object}   opts
 * @param {string}   opts.interestId   the quote being accepted
 * @param {string}   [opts.email]      pre-fills billing details in Stripe's sheet
 * @param {object}   [opts.accepted]   { bookingId, checkoutUrl } from a previous
 *                                     attempt — skips the (non-repeatable) accept
 * @param {Function} [opts.onAccepted] called with { bookingId, checkoutUrl } the
 *                                     instant the booking exists, BEFORE any
 *                                     charge is attempted. This is the caller's
 *                                     only reliable chance to learn that a
 *                                     booking is now on the hook, so it fires on
 *                                     the way past rather than at the end.
 *
 * @returns {Promise<{ outcome: string, bookingId: string, paid?: object }>}
 * @throws  {AcceptedButUnpaidError} declined / failed — booking exists, unpaid
 * @throws  {Error}                  the accept itself failed — no booking exists
 */
export async function acceptQuoteAndPay({
  interestId,
  email,
  accepted,
  onAccepted,
} = {}) {
  let bookingId = accepted?.bookingId;
  let checkoutUrl = accepted?.checkoutUrl;

  // ── 1 · The booking ────────────────────────────────────────────────────────
  // Deliberately NOT wrapped: a failed accept means no booking was created, so
  // there is nothing to clean up and nothing to be honest about. The error goes
  // straight to PaySheet's declined chip like any other confirm failure.
  if (!bookingId) {
    if (!interestId) throw new Error(i18n.t('quotes.noQuote'));

    const res = await api.patch(`/interests/${interestId}/accept`);
    bookingId = res?.booking?.id;
    // The backend's own charge-before-service trigger already opened a hosted
    // Checkout session at accept. Reuse its URL if we end up needing the
    // fallback, rather than minting a second session for the same booking.
    checkoutUrl = res?.checkout_url || null;

    if (!bookingId) {
      // The server accepted but gave us nothing to charge. Refusing here is the
      // point: the alternative is presenting a payment sheet with no booking
      // behind it.
      throw new Error(i18n.t('quotes.noBooking'));
    }

    onAccepted?.({ bookingId, checkoutUrl });
  }

  // ── 2 · The charge, in-app ─────────────────────────────────────────────────
  try {
    const paid = await payForBookingNatively({ bookingId, email });
    return { outcome: ACCEPT_PAID, bookingId, paid };
  } catch (err) {
    // Already captured — a retry that raced the first charge's server-side
    // settle. The client has paid; treat it as the success it is.
    if (isAlreadyPaidError(err)) {
      return { outcome: ACCEPT_PAID, bookingId, paid: null };
    }

    // A dismissed sheet is a choice, not a failure. Report it plainly and let
    // the screen decide what to say — but it MUST say something.
    if (err?.cancelled) {
      return { outcome: ACCEPT_CANCELLED, bookingId };
    }

    // ONLY an unavailable native module falls back to the browser (the fallback
    // rule in services/nativePay.js). A decline must never open Chrome.
    if (err?.nativePayUnavailable) {
      const url = checkoutUrl || (await startHostedCheckout(bookingId));
      if (!url) {
        throw new AcceptedButUnpaidError(i18n.t('quotes.payFailed'), bookingId);
      }
      await Linking.openURL(url);
      return { outcome: ACCEPT_CHECKOUT, bookingId };
    }

    throw new AcceptedButUnpaidError(err?.message, bookingId);
  }
}

/** Hosted Checkout — FALLBACK ONLY, never the default on a build with the sheet. */
async function startHostedCheckout(bookingId) {
  try {
    const res = await api.post(`/payments/stripe/checkout/${bookingId}`, {});
    return res?.url || null;
  } catch (err) {
    return null;
  }
}
