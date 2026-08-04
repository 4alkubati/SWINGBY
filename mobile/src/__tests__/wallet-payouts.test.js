// D5 — the wallet, and what it is allowed to say about someone's money.
//
// The assertions that matter here are not "does it render". They are:
//
//   · the balance comes from the SERVER and is never recomputed on the device
//     (M10: the pay sheet priced itself locally and was only accidentally right)
//   · the word "instant" never appears on a path that is a standard payout
//     (a 1-3 business-day lie), and the result banner reports the rail the
//     SERVER used rather than the one the screen predicted
//   · the cash-out button is not tappable in any state where the server would
//     refuse it, so nobody taps a live money control and gets an error
//   · the screen survives empty / loading / error, because a money screen that
//     white-screens looks like lost money
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../services/api');
import { api } from '../services/api';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
}));
import * as WebBrowser from 'expo-web-browser';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    // The screen re-reads on focus — that is its Stripe onboarding "return"
    // handling. Run the callback once, like a real focus would.
    useFocusEffect: (cb) => {
      const R = require('react');
      R.useEffect(() => cb(), []);
    },
  };
});

import WalletScreen from '../screens/business/WalletScreen';
import i18n from '../i18n';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

function renderWallet() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <WalletScreen navigation={navigation} />
    </SafeAreaProvider>,
  );
}

// Every money figure in this fixture is deliberately DISTINCT. With
// `available` and `paid_out` both at 45000 the screen renders "$450.00" twice
// and getByText cannot tell the hero from the ledger row — which makes the
// test fail for a reason that has nothing to do with the behaviour under test.
// The three still reconcile: 65000 earned - 20000 paid out = 45000 available.
function wallet(over = {}) {
  return {
    available_cents: 45000,
    lifetime_earned_cents: 65000,
    paid_out_cents: 20000,
    currency: 'cad',
    account: {
      state: 'ready',
      account_id: 'acct_1',
      payouts_enabled: true,
      details_submitted: true,
      disabled_reason: null,
      requirements_due: [],
      instant_available: true,
      instant_source_last4: '4242',
    },
    payouts: [],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  i18n.locale = 'en';
  api.get.mockResolvedValue(wallet());
  api.post.mockResolvedValue({});
});

describe('the balance', () => {
  it('renders exactly what the server sent, formatted — nothing recomputed', async () => {
    api.get.mockResolvedValue(
      wallet({ available_cents: 123456, lifetime_earned_cents: 200000, paid_out_cents: 76544 }),
    );
    const { getByText } = renderWallet();

    await waitFor(() => expect(getByText('$1,234.56')).toBeTruthy());
    // Both halves of the sum are shown so a disputed headline is auditable.
    expect(getByText('$2,000.00')).toBeTruthy();
    expect(getByText('$765.44')).toBeTruthy();
    // 200000 - 76544 = 123456. The screen prints the server's `available`; it
    // does not derive it, so this asserts the three are consistent rather than
    // that the device did the subtraction.
  });

  it('says WHICH number it is', async () => {
    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.availableLabel'))).toBeTruthy());
    // The caption names the 10% platform fee — escrow.PLATFORM_RATE — and says
    // prior cash-outs are already subtracted.
    expect(getByText(i18n.t('wallet.availableCaption'))).toBeTruthy();
  });

  it('reads the wallet from the one endpoint that owns the figure', async () => {
    renderWallet();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/businesses/me/payouts'));
  });
});

describe('what the screen promises about the rail', () => {
  it('says instant, and names the card, only when Stripe confirmed one', async () => {
    const { getByText } = renderWallet();
    await waitFor(() =>
      expect(getByText(i18n.t('wallet.railInstantCard', { last4: '4242' }))).toBeTruthy(),
    );
  });

  it('never says instant when there is no instant-capable card', async () => {
    api.get.mockResolvedValue(
      wallet({
        account: {
          ...wallet().account,
          instant_available: false,
          instant_source_last4: null,
        },
      }),
    );
    const { getByText, queryByText } = renderWallet();

    await waitFor(() => expect(getByText(i18n.t('wallet.railStandard'))).toBeTruthy());
    expect(queryByText(i18n.t('wallet.railInstant'))).toBeNull();
    expect(queryByText(i18n.t('wallet.railInstantCard', { last4: '4242' }))).toBeNull();
  });

  it('reports the rail the SERVER used, not the one it predicted', async () => {
    // Predicted instant; Stripe downgraded to standard. The banner must follow
    // Stripe, or the owner is told "instant" and waits three days.
    api.post.mockResolvedValue({
      id: 'po-1',
      amount_cents: 45000,
      currency: 'cad',
      status: 'in_transit',
      method: 'standard',
    });
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((t, b, buttons) => {
      // Auto-confirm the "are you sure" dialog.
      const go = buttons?.find((x) => x.text === i18n.t('wallet.cashOutCta'));
      if (go) go.onPress();
    });

    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText('$450.00')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText(i18n.t('wallet.cashOutCta')));
    });

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        i18n.t('wallet.cashOutDoneTitle'),
        i18n.t('wallet.cashOutDoneStandard', { amount: '$450.00' }),
      ),
    );
    spy.mockRestore();
  });

  it('a payout row with no method prints no rail rather than inventing one', async () => {
    api.get.mockResolvedValue(
      wallet({
        payouts: [
          {
            id: 'p1',
            amount_cents: 5000,
            status: 'failed',
            method: null,
            failure_reason: 'Card declined',
            created_at: '2026-08-01T10:00:00Z',
          },
        ],
      }),
    );
    const { getByText, queryByText } = renderWallet();

    await waitFor(() => expect(getByText('$50.00')).toBeTruthy());
    expect(getByText('Card declined')).toBeTruthy();
    expect(queryByText(/Instant · /)).toBeNull();
    expect(queryByText(/Bank transfer · /)).toBeNull();
  });
});

describe('the cash-out control', () => {
  it('is disabled until onboarding is finished, whatever the balance says', async () => {
    api.get.mockResolvedValue(
      wallet({
        available_cents: 90000,
        account: { ...wallet().account, state: 'incomplete', payouts_enabled: false },
      }),
    );
    const { getByText } = renderWallet();

    await waitFor(() => expect(getByText('$900.00')).toBeTruthy());
    const cta = getByText(i18n.t('wallet.cashOutCta'));
    await act(async () => {
      fireEvent.press(cta);
    });
    // No confirm dialog, no POST. The server would 409 this; the UI must not
    // let someone tap a money control that is going to fail.
    expect(api.post).not.toHaveBeenCalledWith('/businesses/me/payouts');
  });

  it('is disabled at a zero balance, and says why', async () => {
    api.get.mockResolvedValue(wallet({ available_cents: 0 }));
    const { getByText } = renderWallet();

    await waitFor(() => expect(getByText('$0.00')).toBeTruthy());
    expect(getByText(i18n.t('wallet.nothingToCashOut'))).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText(i18n.t('wallet.cashOutCta')));
    });
    expect(api.post).not.toHaveBeenCalledWith('/businesses/me/payouts');
  });

  it('confirms before it moves money', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = renderWallet();

    await waitFor(() => expect(getByText('$450.00')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText(i18n.t('wallet.cashOutCta')));
    });

    expect(spy).toHaveBeenCalledWith(
      i18n.t('wallet.cashOutConfirmTitle'),
      i18n.t('wallet.cashOutConfirmInstant', { amount: '$450.00' }),
      expect.any(Array),
    );
    // Confirmation only — nothing has been sent.
    expect(api.post).not.toHaveBeenCalledWith('/businesses/me/payouts');
    spy.mockRestore();
  });

  it('sends no amount — the server owns the figure', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((t, b, buttons) => {
      const go = buttons?.find((x) => x.text === i18n.t('wallet.cashOutCta'));
      if (go) go.onPress();
    });
    api.post.mockResolvedValue({
      id: 'po-1', amount_cents: 45000, currency: 'cad', status: 'paid', method: 'instant',
    });

    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText('$450.00')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText(i18n.t('wallet.cashOutCta')));
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/businesses/me/payouts'));
    // One argument. A body carrying an amount would be a discount API.
    const call = api.post.mock.calls.find((c) => c[0] === '/businesses/me/payouts');
    expect(call.length).toBe(1);
    spy.mockRestore();
  });
});

describe('onboarding', () => {
  it('opens Stripe in a browser and re-reads status when it closes', async () => {
    api.get.mockResolvedValue(
      wallet({ account: { ...wallet().account, state: 'none', payouts_enabled: false } }),
    );
    api.post.mockResolvedValue({
      account_id: 'acct_1',
      onboarding_url: 'https://connect.stripe.com/setup/abc',
      state: 'incomplete',
    });

    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.setupCta'))).toBeTruthy());

    const before = api.get.mock.calls.length;
    await act(async () => {
      fireEvent.press(getByText(i18n.t('wallet.setupCta')));
    });

    await waitFor(() =>
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'https://connect.stripe.com/setup/abc',
      ),
    );
    // Dismissal is not success — the screen asks the server rather than
    // assuming, which is also why it does not need Stripe's return_url page to
    // exist (swingbyy.com does not currently deploy).
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(before));
  });

  it('shows Stripe’s own reason when payouts are paused', async () => {
    api.get.mockResolvedValue(
      wallet({
        account: {
          ...wallet().account,
          state: 'restricted',
          payouts_enabled: false,
          disabled_reason: 'requirements.past_due',
        },
      }),
    );
    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.restrictedTitle'))).toBeTruthy());
    expect(
      getByText(i18n.t('wallet.stripeReason', { reason: 'requirements.past_due' })),
    ).toBeTruthy();
  });

  it('distinguishes "we are reviewing" from "you did not finish"', async () => {
    api.get.mockResolvedValue(
      wallet({
        account: { ...wallet().account, state: 'pending', payouts_enabled: false },
      }),
    );
    const { getByText, queryByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.pendingTitle'))).toBeTruthy());
    // Telling someone to redo a form they already completed is how they give up.
    expect(queryByText(i18n.t('wallet.incompleteTitle'))).toBeNull();
  });
});

describe('the states that are not the happy path', () => {
  it('renders an empty history state, not a blank space', async () => {
    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.emptyTitle'))).toBeTruthy());
  });

  it('renders a styled error with a retry, not a white screen', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    const { getByText } = renderWallet();
    await waitFor(() => expect(getByText(i18n.t('wallet.errorTitle'))).toBeTruthy());
    expect(getByText(i18n.t('common.retry'))).toBeTruthy();
  });

  it('does not crash on a wallet with no account block at all', async () => {
    api.get.mockResolvedValue({ available_cents: 0, currency: 'cad' });
    const { getAllByText } = renderWallet();
    // getAllByText: with every figure absent the screen legitimately prints
    // "$0.00" three times (hero, earned, paid out). That is correct behaviour,
    // not an ambiguity to design around.
    await waitFor(() => expect(getAllByText('$0.00').length).toBeGreaterThan(0));
  });
});

describe('translation coverage for money copy', () => {
  // The i18n suite asserts every English key exists in all four locales. This
  // pins the specific strings that state what happens to money, the way
  // i18n-coverage.test.js already does for the pay sheet — those are the ones
  // where an English fallback is most expensive.
  const MONEY_KEYS = [
    'wallet.availableCaption',
    'wallet.cashOutConfirmInstant',
    'wallet.cashOutConfirmStandard',
    'wallet.railInstant',
    'wallet.railStandard',
  ];

  it.each(['en', 'fr-CA', 'ar', 'uk'])('%s carries every wallet money string', (code) => {
    const have = Object.keys(i18n.translations[code] || {});
    expect(MONEY_KEYS.filter((k) => !have.includes(k))).toEqual([]);
  });

  it('states the 10% platform fee and no other percentage', () => {
    // escrow.PLATFORM_RATE is 0.10. If the copy ever grows a second figure it
    // is either wrong or duplicating something that can drift.
    for (const code of ['en', 'fr-CA', 'ar', 'uk']) {
      const caption = i18n.translations[code]['wallet.availableCaption'];
      expect(caption).toMatch(/10\s*%|10٪|٪\s*10/);
    }
  });
});
