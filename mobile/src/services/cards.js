// cards.js — the client's saved cards: add, list, remove.
//
// M2. Until now a card was kept only as a SIDE EFFECT of paying once: the
// PaymentIntent carried `setup_future_usage='off_session'`, so Stripe held the
// card on the Customer and the backend recorded which one. That produced a
// saved card the client could not see, could not choose, and could not delete —
// PaymentMethodScreen literally told them to "contact support" to remove it —
// and no card at all until their first successful payment.
//
// A SetupIntent is the same native sheet with no charge attached: the client
// adds a card deliberately, before there is anything to pay for.
//
// WHY THIS IS A SEPARATE MODULE FROM nativePay.js: that file is the pay path
// and every error it throws is about a booking (already paid, cancelled,
// amount changed). Adding a card has none of those states. Sharing the module
// loader and the appearance is worth it; sharing the error vocabulary is not.

import { api } from './api';
import {
  loadStripeModule,
  isNativePaySupported,
  NativePayUnavailableError,
  PaymentCancelledError,
  swingbyAppearance,
} from './nativePay';

/** Saved cards, newest first. `[]` on any failure — see the endpoint. */
export async function listCards() {
  const res = await api.get('/payments/stripe/payment-methods');
  return res?.items || [];
}

/**
 * Add a card through Stripe's native sheet. No charge is made.
 *
 * @returns {Promise<boolean>} true if a card was saved, false if the user
 *   dismissed the sheet. A dismissal is not an error — it is an answer.
 */
export async function addCard({ email } = {}) {
  if (!isNativePaySupported()) {
    throw new NativePayUnavailableError(
      'Adding a card needs the in-app payment sheet, which this build cannot run.',
    );
  }
  const stripe = loadStripeModule();

  // The server refuses with `native_sheet_unavailable:` when it has no
  // publishable key, exactly as the pay path does — mapped to the same error so
  // callers have one thing to catch.
  let sheet;
  try {
    sheet = await api.post('/payments/stripe/setup-intent', {});
  } catch (err) {
    const detail = err?.message || '';
    if (detail.includes('native_sheet_unavailable')) {
      throw new NativePayUnavailableError(detail);
    }
    throw err;
  }

  await stripe.initStripe({
    publishableKey: sheet.publishable_key,
    merchantIdentifier: sheet.apple_merchant_id || undefined,
    urlScheme: 'swingby',
  });

  const init = await stripe.initPaymentSheet({
    merchantDisplayName: sheet.merchant_display_name || 'SwingByy',
    // A SetupIntent, not a PaymentIntent — this is what makes the sheet say
    // "Save" instead of naming an amount.
    setupIntentClientSecret: sheet.setup_intent_client_secret,
    customerId: sheet.customer_id || undefined,
    customerEphemeralKeySecret: sheet.ephemeral_key || undefined,
    // No wallets here on purpose. Apple Pay and Google Pay are payment
    // instruments, not storable cards — offering them on a "save a card" sheet
    // produces a token that cannot be charged off-session later.
    allowsDelayedPaymentMethods: false,
    style: 'alwaysDark',
    appearance: swingbyAppearance(),
    defaultBillingDetails: email ? { email } : undefined,
    returnURL: 'swingby://payment-return',
  });
  if (init?.error) {
    throw new Error(init.error.message || 'Could not open the card form.');
  }

  const result = await stripe.presentPaymentSheet();
  if (result?.error) {
    if (result.error.code === 'Canceled') {
      throw new PaymentCancelledError();
    }
    throw new Error(result.error.message || 'Could not save that card.');
  }
  return true;
}

/** Remove a saved card. Ownership is verified server-side against Stripe. */
export async function removeCard(paymentMethodId) {
  return api.delete(`/payments/stripe/payment-methods/${paymentMethodId}`);
}

/** "Visa •••• 4242" — what a human uses to tell their cards apart. */
export function describeCard(card) {
  const brand = (card?.brand || 'Card').replace(/^./, (c) => c.toUpperCase());
  return card?.last4 ? `${brand} •••• ${card.last4}` : brand;
}

/** True once the card's expiry month has passed. */
export function isExpired(card, now = new Date()) {
  const year = Number(card?.exp_year);
  const month = Number(card?.exp_month);
  if (!year || !month) return false;
  // A card is valid through the END of its expiry month.
  return new Date(year, month, 1) <= now;
}
