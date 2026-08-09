// approve-work-punctuation.test.js — walkthrough bug 6, the other half.
//
// ApproveWorkScreen's release notice reads "Approving releases $X to
// {businessName}." — a literal period appended right after the name. A
// business name that already ends in one ("Douglas Glen Cleaning Co.") came
// out "Co..". Same bug lived in the success toast's text2. Both call sites
// now go through `businessNameForSentence`, which strips any trailing
// period(s) from the name before either template adds its own.

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ApproveWorkScreen from '../ApproveWorkScreen';

jest.mock('../../../services/api');
// eslint-disable-next-line import/first
import api from '../../../services/api';

jest.mock('../../../services/toast', () => ({
  ...jest.requireActual('../../../services/toast'),
  show: jest.fn(),
}));
// eslint-disable-next-line import/first
import * as toast from '../../../services/toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const nav = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { bookingId: 'bk-1' } };

// A name that ends in a period is exactly the case that broke — picked to
// match the walkthrough report verbatim.
const PROOF = {
  booking_id: 'bk-1',
  status: 'submitted',
  business_name: 'Douglas Glen Cleaning Co.',
  service_category: 'cleaning',
  client_photos: [],
  before: [{ url: 'https://example.com/before1.jpg' }],
  after: [{ url: 'https://example.com/after1.jpg' }],
  voice_note: null,
  release: { release_cents: 14950, total_cents: 16000, already_released_cents: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ApproveWorkScreen navigation={nav} route={route} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ApproveWorkScreen — the double-period bug', () => {
  it('never renders ".." in the release notice, regardless of what the name ends with', async () => {
    api.get.mockResolvedValue(PROOF);

    const { queryByText, getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Approving releases/)).toBeTruthy());

    expect(queryByText(/Co\.\./)).toBeNull();
    // Anchored on "to <name>." so this targets the release notice specifically
    // — the hero heading ("<name> sent proof") also contains a bare "Co." and
    // would otherwise make this match twice.
    expect(getByText(/to Douglas Glen Cleaning Co\.(?!\.)/)).toBeTruthy();
  });

  it('does not double the period in the "payment released" success toast either', async () => {
    api.get.mockResolvedValue(PROOF);
    api.post.mockResolvedValue({});
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, body, buttons) => {
        const confirm = buttons.find((b) => b.onPress);
        confirm.onPress();
      });

    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Approve & release payment/)).toBeTruthy());
    fireEvent.press(getByText(/Approve & release payment/));

    await waitFor(() => expect(toast.show).toHaveBeenCalled());
    const successCall = toast.show.mock.calls.find(([arg]) => arg.type === 'success');
    expect(successCall).toBeTruthy();
    expect(successCall[0].text2).not.toMatch(/Co\.\./);
    expect(successCall[0].text2).toMatch(/Co\.$/);

    alertSpy.mockRestore();
  });
});
