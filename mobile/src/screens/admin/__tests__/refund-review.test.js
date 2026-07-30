// The admin decision screen. `PATCH /disputes/{id}/resolve` shipped with zero
// callers anywhere, so this is the first thing that can actually spend the held
// escrow — which makes its guards worth testing rather than eyeballing.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import RefundReviewScreen from '../RefundReviewScreen';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

const DISPUTE = {
  id: 'dis-1',
  booking_id: 'booking-1',
  issue_type: 'cancellation_refund',
  held_amount: 150,
  needs_money_decision: true,
  description: 'Cancelled by the client (late).',
  bookings: {
    id: 'booking-1',
    total_amount: 200,
    service_category: 'Cleaning',
    businesses: { business_name: 'Bow River Cleaning' },
    service_posts: { title: 'Deep clean' },
  },
};

const nav = { goBack: jest.fn(), navigate: jest.fn() };

function renderScreen(dispute = DISPUTE) {
  // SafeAreaProvider with real metrics: ImageViewer calls useSafeAreaInsets and
  // throws "No safe area value available" without one.
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <RefundReviewScreen navigation={nav} route={{ params: { dispute } }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Press the confirm action of the most recent Alert.
 *
 * Wrapped in act(): the handler is async and flips `submitting`, so without it
 * React logs "an update was not wrapped in act(...)" on every decision test.
 */
function confirmAlert(spy) {
  const buttons = spy.mock.calls.at(-1)[2];
  const action = buttons.find((b) => b.onPress);
  return act(async () => {
    await action.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({
    before: [{ url: 'https://x/b1.jpg' }],
    after: [{ url: 'https://x/a1.jpg' }],
    client_photos: [],
    voice_note: { url: 'https://x/v.m4a', duration_seconds: 12 },
  });
  api.patch.mockResolvedValue({});
});

describe('the decision cannot be made carelessly', () => {
  it('refuses to submit without a note', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.press(getByText('Approve refund'));

    // Warned, and nothing sent — the note is what the record is made of.
    expect(alert).toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toMatch(/note/i);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('refuses a partial refund larger than what is held', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.changeText(
      getByPlaceholderText('What the proof showed, and why.'),
      'After photos show the job was mostly done.'
    );
    fireEvent.changeText(getByPlaceholderText('Blank refunds the full $150.00'), '900');
    fireEvent.press(getByText('Approve refund'));

    expect(alert.mock.calls[0][0]).toMatch(/more than is held/i);
    expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('approving', () => {
  it('sends the note and approve:true, with no amount when refunding in full', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.changeText(
      getByPlaceholderText('What the proof showed, and why.'),
      'Nothing was done. Full refund.'
    );
    fireEvent.press(getByText('Approve refund'));
    await confirmAlert(alert);

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const [url, body] = api.patch.mock.calls[0];
    expect(url).toBe('/disputes/dis-1/resolve');
    expect(body.approve).toBe(true);
    expect(body.resolution).toMatch(/full refund/i);
    // Omitted, so the server refunds whatever is actually held rather than a
    // figure this screen computed.
    expect(body).not.toHaveProperty('refund_amount');
  });

  it('passes a partial amount through when one is given', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.changeText(
      getByPlaceholderText('What the proof showed, and why.'),
      'Half the work was done.'
    );
    fireEvent.changeText(getByPlaceholderText('Blank refunds the full $150.00'), '75');
    fireEvent.press(getByText('Approve refund'));
    await confirmAlert(alert);

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][1].refund_amount).toBe(75);
  });
});

describe('declining', () => {
  it('sends approve:false and never an amount', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText } = renderScreen();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.changeText(
      getByPlaceholderText('What the proof showed, and why.'),
      'Before and after show the job was completed as described.'
    );
    fireEvent.press(getByText('Decline'));
    await confirmAlert(alert);

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const body = api.patch.mock.calls[0][1];
    expect(body.approve).toBe(false);
    expect(body).not.toHaveProperty('refund_amount');
  });
});

describe('missing proof', () => {
  it('still allows a decision instead of blanking the screen', async () => {
    // The evidence failing to load is not a reason to strand held money.
    api.get.mockRejectedValue(new Error('Access denied'));
    const { getByText } = renderScreen();

    await waitFor(() => expect(getByText('Approve refund')).toBeTruthy());
    expect(getByText(/Access denied/)).toBeTruthy();
  });
});
