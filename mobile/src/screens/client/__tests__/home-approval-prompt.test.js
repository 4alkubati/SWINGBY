// Walkthrough bug 1 (Kira, device walkthrough 2026-08-06): the client is never
// told there is anything to approve, while a 24-hour timer releases the money
// for them.
//
// Approving was Home → My Jobs → Past → tap the booking → scroll → Approve →
// confirm. Five taps, seven through the overflow, on the one action in the
// product that moves someone's money — filed under "Past", badged "DONE", with
// nothing on Home. If it was never found the payment released on the timer
// anyway, which is a fallback, not a flow.
//
// These pin the prompt itself: it is on Home, it is above the live job, it
// names the amount and the deadline, both answers are on the card, and it is
// gated on the LEDGER (payment_state) rather than on the booking row.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import HomeScreen from '../HomeScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('../../../services/location', () => ({
  getUserLocation: jest.fn(() => Promise.resolve({ lat: 51.04, lng: -114.07 })),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'client-1', role: 'client', first_name: 'Ali' } }),
}));

const nav = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

function finishedBooking(overrides = {}) {
  return {
    id: 'bk-1',
    status: 'completed',
    total_amount: 195,
    businesses: { business_name: 'Douglas Glen' },
    service_posts: { title: 'Deep clean' },
    approval_deadline_at: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    payment_state: {
      state: 'held',
      label: 'Held in escrow',
      capture_backed: true,
      amount_held: 195,
      amount_due: 0,
      amount_released: 0,
      amount_total: 195,
    },
    ...overrides,
  };
}

// Home fires three requests on mount; only /bookings/ matters here.
function mockHome(bookings) {
  api.get.mockImplementation((path) => {
    if (path === '/bookings/') return Promise.resolve({ items: bookings });
    if (path === '/service-posts/my') return Promise.resolve({ items: [] });
    return Promise.resolve([]);
  });
}

function renderHome() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <HomeScreen navigation={nav} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockResolvedValue({});
});

describe('the client is prompted on Home to approve finished work', () => {
  it('names the business, the amount and the deadline', async () => {
    mockHome([finishedBooking()]);
    const utils = renderHome();

    await waitFor(() =>
      expect(
        utils.getByText(i18n.t('approvalCard.title', { business: 'Douglas Glen' })),
      ).toBeTruthy(),
    );
    // $195, not $195.00 — whole dollars read better in a sentence.
    expect(
      utils.getByText(i18n.t('approvalCard.amountHeld', { amount: '$195' })),
    ).toBeTruthy();
    expect(
      utils.getByText(i18n.t('approvalCard.deadlineHours', { hours: 20 })),
    ).toBeTruthy();
  });

  it('offers both answers, not just the one that pays out', async () => {
    mockHome([finishedBooking()]);
    const utils = renderHome();

    await waitFor(() =>
      expect(utils.getByText(i18n.t('approval.approveShort'))).toBeTruthy(),
    );
    expect(utils.getByText(i18n.t('approvalCard.somethingWrong'))).toBeTruthy();
  });

  it('sits ABOVE the live job — a deadline outranks a schedule', async () => {
    const live = {
      id: 'bk-2',
      status: 'in_progress',
      businesses: { business_name: 'Other Pro' },
      service_posts: { title: 'Gutter clearing' },
      confirmed_date: new Date().toISOString(),
    };
    // Deliberately ordered live-first in the payload, the way the API returns
    // it (created_at desc): the ordering under test is Home's, not the API's.
    mockHome([live, finishedBooking()]);
    const utils = renderHome();

    await waitFor(() => expect(utils.getByText('Gutter clearing')).toBeTruthy());

    // Compare positions in the rendered tree itself — the card is only useful
    // if it is the first thing on the screen, so the order is the assertion.
    // Walks `children` only: element props carry the provider context objects
    // and are circular, so the tree cannot simply be stringified.
    const texts = [];
    (function walk(node) {
      if (node == null) return;
      if (typeof node === 'string') return void texts.push(node);
      if (Array.isArray(node)) return void node.forEach(walk);
      walk(node.children);
    })(utils.toJSON());

    const approvalAt = texts.findIndex((t) =>
      t.includes(i18n.t('approvalCard.title', { business: 'Douglas Glen' })),
    );
    const liveJobAt = texts.findIndex((t) => t.includes('Gutter clearing'));
    expect(approvalAt).toBeGreaterThan(-1);
    expect(liveJobAt).toBeGreaterThan(-1);
    expect(approvalAt).toBeLessThan(liveJobAt);
  });

  it('confirms, names the amount again, then releases via /approve', async () => {
    mockHome([finishedBooking()]);
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const utils = renderHome();

    await waitFor(() =>
      expect(utils.getByText(i18n.t('approval.approveShort'))).toBeTruthy(),
    );
    fireEvent.press(utils.getByText(i18n.t('approval.approveShort')));

    // Irreversible, and this card sits under a scrolling thumb.
    expect(spy).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    const [, body] = spy.mock.calls.at(-1);
    expect(body).toContain('$195.00');

    const confirm = spy.mock.calls.at(-1)[2].find((b) => b.onPress);
    await act(async () => {
      await confirm.onPress();
    });
    // The booking-level endpoint, not /proof/approve: most jobs never get
    // photos, and those clients still need a way to say "yes, this is done".
    expect(api.post).toHaveBeenCalledWith('/bookings/bk-1/approve');
    spy.mockRestore();
  });

  it('sends "Something\'s wrong" to the dispute flow, money still held', async () => {
    mockHome([finishedBooking()]);
    const utils = renderHome();

    await waitFor(() =>
      expect(utils.getByText(i18n.t('approvalCard.somethingWrong'))).toBeTruthy(),
    );
    fireEvent.press(utils.getByText(i18n.t('approvalCard.somethingWrong')));

    expect(nav.navigate).toHaveBeenCalledWith('DisputeFlow', { bookingId: 'bk-1' });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('opens the before/after photos when the card body is tapped', async () => {
    mockHome([finishedBooking()]);
    const utils = renderHome();

    await waitFor(() =>
      expect(utils.getByText(i18n.t('approvalCard.seePhotos'))).toBeTruthy(),
    );
    fireEvent.press(
      utils.getByLabelText(
        i18n.t('approvalCard.a11yReview', { business: 'Douglas Glen' }),
      ),
    );

    expect(nav.navigate).toHaveBeenCalledWith('ApproveWork', { bookingId: 'bk-1' });
  });
});

describe('the prompt is gated on the ledger, not on the booking row', () => {
  it('stays away once the payment is released', async () => {
    mockHome([
      finishedBooking({
        approval_deadline_at: null,
        payment_state: { state: 'released', amount_held: 0, amount_released: 195 },
      }),
    ]);
    const utils = renderHome();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/bookings/', expect.anything()));
    expect(
      utils.queryByText(i18n.t('approvalCard.title', { business: 'Douglas Glen' })),
    ).toBeNull();
  });

  it('stays away when nothing was ever captured', async () => {
    // FINDING C's phantom escrow: a booking row can say completed with a
    // payments row claiming 'held' and no PaymentIntent behind it.
    // payment_state fails that closed to 'unpaid' — there is nothing to
    // release, so there is nothing to ask about.
    mockHome([
      finishedBooking({
        payment_state: { state: 'unpaid', capture_backed: false, amount_held: 0 },
      }),
    ]);
    const utils = renderHome();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/bookings/', expect.anything()));
    expect(
      utils.queryByText(i18n.t('approvalCard.title', { business: 'Douglas Glen' })),
    ).toBeNull();
  });

  it('stays away while the job is still running', async () => {
    mockHome([finishedBooking({ status: 'in_progress' })]);
    const utils = renderHome();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/bookings/', expect.anything()));
    expect(
      utils.queryByText(i18n.t('approvalCard.title', { business: 'Douglas Glen' })),
    ).toBeNull();
  });

  it('never counts a deadline down past zero', async () => {
    // The sweep is a cron, so a booking can sit here with the money still held
    // for a few minutes after its window closed. "Releases in -1h" is not a
    // thing to say to someone about their money.
    mockHome([
      finishedBooking({
        approval_deadline_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      }),
    ]);
    const utils = renderHome();

    await waitFor(() =>
      expect(utils.getByText(i18n.t('approvalCard.deadlineNow'))).toBeTruthy(),
    );
    // Still approvable: the endpoint is idempotent and releasing is what the
    // client wanted either way.
    expect(utils.getByText(i18n.t('approval.approveShort'))).toBeTruthy();
  });
});
