// nativePay.test.js — M9, the in-app Stripe Payment Sheet.
//
// The single most important thing pinned here is the FALLBACK RULE:
// only an unavailable native module may fall back to hosted Checkout. A
// decline, a cancel, or a network error must NOT, because falling back on
// those would throw the client into a browser at exactly the moment they are
// least able to tell a bug from a refusal — which is the M9 complaint,
// reintroduced as an error path.

// One stable spy across every jest.resetModules() below. A factory that built
// a fresh jest.fn() each time would hand the test a spy the module under test
// is no longer using.
const mockPost = jest.fn();
jest.mock('../api', () => ({ api: { post: mockPost } }));

const api = { post: mockPost };

const SHEET = {
  payment_intent_id: 'pi_1',
  client_secret: 'pi_1_secret',
  ephemeral_key: 'ek_1',
  customer_id: 'cus_1',
  publishable_key: 'pk_test_1',
  amount_cents: 20000,
  currency: 'cad',
  merchant_display_name: 'SwingByy',
};

// NOT jest.isolateModules: nativePay requires the native module LAZILY, at pay
// time, and isolateModules restores the module registry the moment its callback
// returns — so the mock would be gone before the code under test ever looked
// for it. resetModules + doMock persists for the rest of the test.
function loadModuleWithStripe(stripeMock) {
  jest.resetModules();
  if (stripeMock === null) {
    jest.doMock('@stripe/stripe-react-native', () => {
      throw new Error('native module not linked');
    });
  } else {
    jest.doMock('@stripe/stripe-react-native', () => stripeMock);
  }
  return require('../nativePay');
}

function workingStripe(overrides = {}) {
  return {
    initStripe: jest.fn().mockResolvedValue(undefined),
    initPaymentSheet: jest.fn().mockResolvedValue({}),
    presentPaymentSheet: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockReset();
});

describe('availability', () => {
  it('is unsupported when the native module will not load', () => {
    const mod = loadModuleWithStripe(null);
    expect(mod.isNativePaySupported()).toBe(false);
  });

  it('is unsupported when the module loads but has no sheet methods (Expo Go)', () => {
    // The package resolves in Expo Go, but its native methods are absent.
    // Presence of the export — not the require succeeding — is the real check.
    const mod = loadModuleWithStripe({ initStripe: jest.fn() });
    expect(mod.isNativePaySupported()).toBe(false);
  });

  it('is supported when the sheet methods exist', () => {
    const mod = loadModuleWithStripe(workingStripe());
    expect(mod.isNativePaySupported()).toBe(true);
  });
});

describe('the fallback rule', () => {
  it('a missing native module is a fallback', async () => {
    const mod = loadModuleWithStripe(null);
    await expect(mod.payForBookingNatively({ bookingId: 'bk_1' })).rejects.toMatchObject({
      nativePayUnavailable: true,
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("the server saying 'native_sheet_unavailable' is a fallback", async () => {
    const mod = loadModuleWithStripe(workingStripe());
    api.post.mockRejectedValueOnce(
      new Error('native_sheet_unavailable: STRIPE_PUBLISHABLE_KEY is not set'),
    );
    await expect(mod.payForBookingNatively({ bookingId: 'bk_1' })).rejects.toMatchObject({
      nativePayUnavailable: true,
    });
  });

  it('an undeployed endpoint (404) is a fallback', async () => {
    const mod = loadModuleWithStripe(workingStripe());
    api.post.mockRejectedValueOnce(new Error('Not Found'));
    await expect(mod.payForBookingNatively({ bookingId: 'bk_1' })).rejects.toMatchObject({
      nativePayUnavailable: true,
    });
  });

  it('a DECLINE is NOT a fallback — it must never open a browser', async () => {
    const stripe = workingStripe({
      presentPaymentSheet: jest
        .fn()
        .mockResolvedValue({ error: { code: 'Failed', message: 'Your card was declined.' } }),
    });
    const mod = loadModuleWithStripe(stripe);
    api.post.mockResolvedValueOnce({ ...SHEET });

    const err = await mod
      .payForBookingNatively({ bookingId: 'bk_1' })
      .catch((e) => e);
    expect(err.message).toBe('Your card was declined.');
    expect(err.nativePayUnavailable).toBeUndefined();
  });

  it('a CANCEL is not a fallback and not a failure', async () => {
    const stripe = workingStripe({
      presentPaymentSheet: jest
        .fn()
        .mockResolvedValue({ error: { code: 'Canceled', message: 'cancelled' } }),
    });
    const mod = loadModuleWithStripe(stripe);
    api.post.mockResolvedValueOnce({ ...SHEET });

    const err = await mod.payForBookingNatively({ bookingId: 'bk_1' }).catch((e) => e);
    expect(err.cancelled).toBe(true);
    expect(err.nativePayUnavailable).toBeUndefined();
  });

  it('a server error that is not an availability problem surfaces as-is', async () => {
    const mod = loadModuleWithStripe(workingStripe());
    api.post.mockRejectedValueOnce(new Error('Booking is cancelled'));
    const err = await mod.payForBookingNatively({ bookingId: 'bk_1' }).catch((e) => e);
    expect(err.message).toBe('Booking is cancelled');
    expect(err.nativePayUnavailable).toBeUndefined();
  });
});

describe('the happy path', () => {
  it('presents a SwingByy-branded sheet and settles server-side', async () => {
    const stripe = workingStripe();
    const mod = loadModuleWithStripe(stripe);
    api.post
      .mockResolvedValueOnce({ ...SHEET }) // create intent
      .mockResolvedValueOnce({ status: 'succeeded', settled: true }); // confirm

    const result = await mod.payForBookingNatively({
      bookingId: 'bk_1',
      email: 'jane@example.com',
    });

    expect(result).toEqual({ paymentIntentId: 'pi_1', amountCents: 20000 });

    // The key comes from the server, so rotating it needs no app rebuild.
    expect(stripe.initStripe).toHaveBeenCalledWith(
      expect.objectContaining({ publishableKey: 'pk_test_1', urlScheme: 'swingby' }),
    );

    const init = stripe.initPaymentSheet.mock.calls[0][0];
    expect(init.paymentIntentClientSecret).toBe('pi_1_secret');
    expect(init.customerId).toBe('cus_1');
    expect(init.customerEphemeralKeySecret).toBe('ek_1');
    // Branding: the sheet must say SwingBy.
    expect(init.merchantDisplayName).toBe('SwingByy');
    // Escrow depends on the money having actually arrived before work is
    // scheduled. Delayed methods settle days later — FINDING C by another name.
    expect(init.allowsDelayedPaymentMethods).toBe(false);

    // Settled immediately rather than waiting on the webhook, so the
    // already-paid guard is deterministic for anything that runs next.
    expect(api.post).toHaveBeenLastCalledWith(
      '/payments/stripe/payment-intent/bk_1/confirm',
      { payment_intent_id: 'pi_1' },
      { _silent: true },
    );
  });

  it('still reports success when the confirm call fails — the webhook settles', async () => {
    const mod = loadModuleWithStripe(workingStripe());
    api.post
      .mockResolvedValueOnce({ ...SHEET })
      .mockRejectedValueOnce(new Error('network down'));

    // The client has already paid. Showing them an error here, or asking them
    // to pay again, would be the worst possible outcome.
    await expect(
      mod.payForBookingNatively({ bookingId: 'bk_1' }),
    ).resolves.toMatchObject({ paymentIntentId: 'pi_1' });
  });

  it('refuses to charge without a booking to charge against', async () => {
    const mod = loadModuleWithStripe(workingStripe());
    await expect(mod.payForBookingNatively({})).rejects.toMatchObject({
      nativePayUnavailable: true,
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('treats a server session missing its client_secret as unavailable', async () => {
    const mod = loadModuleWithStripe(workingStripe());
    api.post.mockResolvedValueOnce({ publishable_key: 'pk_test_1' });
    await expect(mod.payForBookingNatively({ bookingId: 'bk_1' })).rejects.toMatchObject({
      nativePayUnavailable: true,
    });
  });
});

describe('branding', () => {
  it('uses Jet x Pulse tokens, not Stripe defaults', () => {
    const mod = loadModuleWithStripe(workingStripe());
    const { colors } = require('../../theme/tokens');
    const appearance = mod.swingbyAppearance();

    expect(appearance.colors.background).toBe(colors.surface);
    expect(appearance.colors.componentBackground).toBe(colors.surfaceAlt);
    expect(appearance.colors.primary).toBe(colors.accent);
    expect(appearance.colors.error).toBe(colors.danger);
    expect(appearance.primaryButton.colors.background).toBe(colors.accentBtn);
  });
});

describe('isAlreadyPaidError', () => {
  it('recognises the server refusing a second charge', () => {
    const mod = loadModuleWithStripe(workingStripe());
    expect(
      mod.isAlreadyPaidError(new Error('already_paid: this booking has already been paid.')),
    ).toBe(true);
    expect(mod.isAlreadyPaidError(new Error('Your card was declined.'))).toBe(false);
    expect(mod.isAlreadyPaidError(null)).toBe(false);
  });
});
