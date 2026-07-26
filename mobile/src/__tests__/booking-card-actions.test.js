/**
 * booking-card-actions.test.js — WALKTHROUGH D6.
 *
 * "Booking card actions: Cancel / Full details / My disputes / Message —
 *  'Message' is redundant when you can message from the booking."
 *
 * The full-width "Message <name>" button was the fourth route to the same chat
 * on one screen. It is gone. The two things this locks down are the two ways
 * that fix could go wrong:
 *
 *   1. the duplicate is actually gone (not just moved down the stack), and
 *   2. removing it did not take away anyone's only route — the message control
 *      beside Call is still there, still reachable by an assistive technology,
 *      and still opens the chat for this booking.
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../services/api');
import { api } from '../services/api';

import ActiveBookingScreen from '../screens/client/ActiveBookingScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const BOOKING = {
  id: 'bk-1',
  business_id: 'biz-1',
  status: 'confirmed',
  created_at: '2026-07-26T10:00:00Z',
  total_amount: 195,
  confirmed_date: '2026-07-27T14:00:00Z',
  service_category: 'cleaning',
  businesses: { business_name: 'Test Cleaning Co.', avg_rating: 4.8 },
  employees: { role_title: 'Cleaner', users: { first_name: 'Dana', last_name: 'Reid' } },
  service_posts: { title: 'Deep clean', address: '123 Kensington Rd NW' },
};

function renderScreen() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ActiveBookingScreen navigation={navigation} route={{ params: { bookingId: 'bk-1' } }} />
    </SafeAreaProvider>,
  );
  return { ...utils, navigation };
}

beforeEach(() => {
  api.get.mockResolvedValue(BOOKING);
});

describe('D6 — the redundant Message action', () => {
  it('no longer renders a full-width Message button', async () => {
    const { queryByText, getByText } = renderScreen();
    // The other three stacked actions are still there, so this is a
    // one-button removal and not the whole stack disappearing.
    await waitFor(() => getByText('My disputes'));
    expect(queryByText(/^Message /)).toBeNull();
  });

  it('keeps the other actions the audit listed', async () => {
    const { getByText } = renderScreen();
    await waitFor(() => getByText('My disputes'));
    expect(getByText('Cancel booking')).toBeTruthy();
    expect(getByText('My disputes')).toBeTruthy();
  });

  it('still gives the client a labelled route into the chat', async () => {
    const { getByLabelText, navigation } = renderScreen();
    const control = await waitFor(() => getByLabelText('Message Dana Reid'));
    fireEvent.press(control);
    expect(navigation.navigate).toHaveBeenCalledWith(
      'Chat',
      expect.objectContaining({ bookingId: 'bk-1' }),
    );
  });
});
