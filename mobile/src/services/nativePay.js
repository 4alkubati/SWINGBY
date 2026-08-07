// nativePay.js — Stripe's Payment Sheet, presented INSIDE SwingBy.
//
// M9 (walkthrough audit 2026-07-24): "Uber doesn't bounce you to a hosted page."
// The old flow asked the backend for a Stripe Checkout URL and handed it to
// `Linking.openURL`, which throws the client into Chrome/Safari, onto a page
// that is not SwingBy, and hopes they come back. This module replaces that with
// Stripe's native Payment Sheet: a real bottom sheet, in-process, styled with
// the Jet × Pulse tokens so it reads as SwingBy.
//
// WHAT THIS MODULE DOES NOT DO
// It does not decide *whether* to charge, and it does not touch the ledger. It
// asks the backend for a PaymentIntent, shows the sheet, and reports what
// happened. Money is recorded server-side when Stripe's
// `payment_intent.succeeded` webhook lands — the same webhook path hosted
// Checkout has always settled through. A client that force-quits mid-payment
// still gets a correctly settled booking, because settlement was never the
// device's job.
//
// FALLBACK, NEVER THE DEFAULT
// The native sheet is unavailable in three real situations:
//   1. Expo Go / any JS-only runtime — the native module is not linked.
//   2. A build that predates @stripe/stripe-react-native.
//   3. A backend with no STRIPE_PUBLISHABLE_KEY set.
// All three throw `NativePayUnavailableError`, and ONLY that error should make
// a caller fall back to hosted Checkout. A decline, a cancel, or a network
// failure must NOT silently bounce the client to a browser — that would be the
// bug M9 is about, reintroduced as an error path.

import { api } from './api';
import { colors, radius } from '../theme/tokens';

// ─── Errors ──────────────────────────────────────────────────────────────────

/** The native sheet cannot run here. The ONLY error that justifies falling back. */
export class NativePayUnavailableError extends Error {
  constructor(message) {
    super(message || 'The in-app payment sheet is unavailable on this device.');
    this.name = 'NativePayUnavailableError';
    this.nativePayUnavailable = true;
  }
}

/** The client dismissed the sheet. Not a failure — say nothing, charge nothing. */
export class PaymentCancelledError extends Error {
  constructor(message) {
    super(message || 'Payment cancelled.');
    this.name = 'PaymentCancelledError';
    this.cancelled = true;
  }
}

/** The booking already has a captured charge behind it. Treated as success. */
export function isAlreadyPaidError(err) {
  return /already_paid/i.test(err?.message || '');
}

function isUnavailableDetail(message) {
  const msg = (message || '').toLowerCase();
  return (
    msg.includes('native_sheet_unavailable') ||
    // An older backend that has not deployed the endpoint yet.
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('method not allowed') ||
    msg.includes('405')
  );
}

// ─── Native module ───────────────────────────────────────────────────────────
// Required lazily and defensively. A top-level `import` of a native module
// would crash the whole JS bundle at startup in Expo Go and in the Jest
// environment, taking down screens that have nothing to do with payments.

let _stripeModule;
let _stripeResolved = false;

export function loadStripeModule() {
  if (_stripeResolved) return _stripeModule;
  _stripeResolved = true;
  try {
    // eslint-disable-next-line global-require
    const mod = require('@stripe/stripe-react-native');
    // In Expo Go the package resolves but its native methods are missing, so
    // presence of the export is the real capability check, not the require.
    _stripeModule =
      mod && typeof mod.initPaymentSheet === 'function' && typeof mod.presentPaymentSheet === 'function'
        ? mod
        : null;
  } catch (err) {
    _stripeModule = null;
  }
  return _stripeModule;
}

/** True if the native Payment Sheet can be presented in this runtime. */
export function isNativePaySupported() {
  return !!loadStripeModule();
}

/** Test seam — reset the memoised module lookup. */
export function __resetStripeModule() {
  _stripeModule = undefined;
  _stripeResolved = false;
}

// ─── Branding ────────────────────────────────────────────────────────────────
// PAYMENTS.md / DESIGN-SYSTEM.md, mapped onto Stripe's appearance API. The
// sheet is chrome we do not own, so this is as close to Jet × Pulse as the API
// allows: jet surfaces, pulse-purple primary button, 12px button radius (never
// pills), money-green nowhere — Stripe uses `primary` for selection, and green
// is reserved for amounts in OUR surfaces only.

export function swingbyAppearance() {
  return {
    colors: {
      primary: colors.accent,
      background: colors.surface,
      componentBackground: colors.surfaceAlt,
      componentBorder: colors.border,
      componentDivider: colors.border,
      primaryText: colors.textPrimary,
      secondaryText: colors.textSecondary,
      componentText: colors.textPrimary,
      placeholderText: colors.textSecondary,
      icon: colors.textSecondary,
      error: colors.danger,
    },
    shapes: {
      // Cards/inputs echo the breakdown card in PaySheet (16), buttons are 12.
      borderRadius: 14,
      borderWidth: 1,
    },
    primaryButton: {
      colors: {
        background: colors.accentBtn,
        text: colors.textPrimary,
        border: colors.accentBtn,
      },
      shapes: { borderRadius: radius.button },
    },
  };
}

// ─── The one call a caller makes ─────────────────────────────────────────────

/**
 * Charge a booking with the native Stripe Payment Sheet.
 *
 * @param {object}   opts
 * @param {string}   opts.bookingId
 * @param {string}   [opts.email]   pre-fills billing details
 * @returns {Promise<{ paymentIntentId: string, amountCents: number }>}
 *
 * @throws {NativePayUnavailableError} caller should fall back to hosted Checkout
 * @throws {PaymentCancelledError}     client dismissed the sheet — do nothing
 * @throws {Error}                     declined / failed — show the message
 */
export async function payForBookingNatively({ bookingId, email } = {}) {
  if (!bookingId) {
    throw new NativePayUnavailableError('No booking to pay for yet.');
  }

  const stripe = loadStripeModule();
  if (!stripe) {
    throw new NativePayUnavailableError(
      'This build cannot show the in-app payment sheet.',
    );
  }

  // 1 · Ask the server for the intent. `_silent` because a failure here is a
  //     fallback trigger, not something to toast at the client — the global
  //     interceptor would otherwise flash "Request failed" a beat before the
  //     hosted page opens and the payment succeeds.
  let sheet;
  try {
    sheet = await api.post(
      `/payments/stripe/payment-intent/${bookingId}`,
      {},
      { _silent: true },
    );
  } catch (err) {
    if (isUnavailableDetail(err?.message)) {
      throw new NativePayUnavailableError(err?.message);
    }
    throw err;
  }

  if (!sheet?.client_secret || !sheet?.publishable_key) {
    throw new NativePayUnavailableError(
      'The server did not return a usable payment session.',
    );
  }

  // 2 · Point the SDK at our Stripe account. Done here rather than via
  //     <StripeProvider> at the app root so the publishable key comes from the
  //     server at pay time: rotating it needs no app rebuild, and the key is
  //     never baked into the shipped bundle.
  // `merchantIdentifier` is Apple Pay's, and it comes from the SERVER response
  // so the wallet turns on without an app rebuild the moment the merchant id
  // exists in Stripe. app.config.js still gates the iOS ENTITLEMENT on the
  // build-time env var, because that part genuinely cannot be decided at
  // runtime — but everything else here is finished and waiting.
  await stripe.initStripe({
    publishableKey: sheet.publishable_key,
    merchantIdentifier: sheet.apple_merchant_id || undefined,
    // Lets Stripe auto-dismiss a 3DS web view back into the app.
    urlScheme: 'swingby',
  });

  // 3 · Build the sheet.
  const initResult = await stripe.initPaymentSheet({
    merchantDisplayName: sheet.merchant_display_name || 'Swingbyy',
    paymentIntentClientSecret: sheet.client_secret,
    customerId: sheet.customer_id || undefined,
    customerEphemeralKeySecret: sheet.ephemeral_key || undefined,
    // Escrow depends on money having actually ARRIVED before work is scheduled.
    // Delayed methods (ACH, SEPA, Boleto) settle days later and would let a job
    // go live against money that has not landed — precisely FINDING C. Off.
    allowsDelayedPaymentMethods: false,
    // ── Wallets ──────────────────────────────────────────────────────────
    // Google Pay needs no merchant registration (Stripe's own merchant id
    // covers it), so it is simply on. `testEnv` follows the key actually in
    // use: a live key with testEnv:true silently refuses to charge.
    googlePay: {
      merchantCountryCode: 'CA',
      currencyCode: 'CAD',
      testEnv: !String(sheet.publishable_key || '').startsWith('pk_live'),
    },
    // Apple Pay is only offered when the server names a merchant id. Passing
    // an applePay block WITHOUT one makes the sheet render an Apple Pay button
    // that fails when tapped — worse than not offering it.
    ...(sheet.apple_merchant_id
      ? {
          applePay: {
            merchantCountryCode: 'CA',
          },
        }
      : {}),
    style: 'alwaysDark',
    appearance: swingbyAppearance(),
    defaultBillingDetails: email ? { email } : undefined,
    returnURL: 'swingby://payment-return',
  });
  if (initResult?.error) {
    throw new Error(initResult.error.message || 'Could not start the payment.');
  }

  // 4 · Present it. This is the moment the browser used to open.
  const presentResult = await stripe.presentPaymentSheet();
  if (presentResult?.error) {
    const { code, message } = presentResult.error;
    if (code === 'Canceled' || code === 'Cancelled') {
      throw new PaymentCancelledError(message);
    }
    throw new Error(message || 'That payment did not go through.');
  }

  // 5 · Tell the server to settle NOW rather than waiting on the webhook.
  //     Not a second source of truth: the server re-reads the intent from
  //     Stripe and runs the same ledger function the webhook runs. This exists
  //     to close a window — between the sheet closing and the webhook landing,
  //     the booking still looks unpaid, and anything that offers to "pay" in
  //     that window would take the money twice.
  //
  //     Best-effort on purpose. If this call fails the webhook still settles
  //     the booking; the client has already paid and must not be shown an
  //     error, let alone asked to pay again.
  try {
    await api.post(
      `/payments/stripe/payment-intent/${bookingId}/confirm`,
      { payment_intent_id: sheet.payment_intent_id },
      { _silent: true },
    );
  } catch (err) {
    // Intentionally swallowed. Logged only.
    // eslint-disable-next-line no-console
    console.warn('[nativePay] confirm failed, webhook will settle:', err?.message);
  }

  return {
    paymentIntentId: sheet.payment_intent_id,
    amountCents: sheet.amount_cents,
  };
}
