// Walkthrough bug 3 — the business "Send for approval" toast promised
// something the backend doesn't do.
//
// POST /bookings/{id}/proof/submit only flips booking_proofs.status to
// 'submitted'. It never touches bookings.status, and the client has no route
// to an approve action until that's 'completed' (backend/app/api/bookings.py
// approve_completed_work, gated at `if booking.get("status") != "completed"`;
// the client-side entry point is itself gated on `isCompleted` in
// BookingDetailsScreen). So "Sent for approval — Payment releases when the
// client approves" was false on both halves: nothing was sent anywhere the
// client could see it yet, and nothing releases from this action.
//
// This pins the corrected toast: it must not claim approval/release, and it
// must tell the business the step that's still needed (Mark complete).
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProofOfWorkScreen from '../ProofOfWorkScreen';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('../../../services/toast', () => ({
  ...jest.requireActual('../../../services/toast'),
  show: jest.fn(),
}));
import * as toast from '../../../services/toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function proof(overrides = {}) {
  return {
    status: 'draft',
    client_photos: [],
    before: [{ id: 'b1', url: 'https://cdn.test/b1.jpg' }, { id: 'b2', url: 'https://cdn.test/b2.jpg' }],
    after: [{ id: 'a1', url: 'https://cdn.test/a1.jpg' }, { id: 'a2', url: 'https://cdn.test/a2.jpg' }],
    voice_note: null,
    counts: { before: 2, after: 2, before_needed: 0, after_needed: 0, can_submit: true },
    ...overrides,
  };
}

function renderScreen(goBack = jest.fn()) {
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProofOfWorkScreen
        navigation={{ goBack }}
        route={{ params: { bookingId: 'bk-1' } }}
      />
    </SafeAreaProvider>,
  );
  return { ...utils, goBack };
}

describe('ProofOfWorkScreen — "Send for approval" toast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tells the business the proof was saved and that Mark complete is still needed, not that payment releases', async () => {
    api.get.mockResolvedValue(proof());
    api.post.mockResolvedValue({});

    const { getByLabelText, goBack } = renderScreen();

    const cta = await waitFor(() => getByLabelText('Send for approval'));
    fireEvent.press(cta);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/bookings/bk-1/proof/submit'));
    await waitFor(() => expect(toast.show).toHaveBeenCalled());

    const call = toast.show.mock.calls[0][0];
    // The lie: this used to say "Sent for approval" / "Payment releases when
    // the client approves". Neither claim is true the moment submit resolves.
    expect(call.text1).not.toMatch(/sent for approval/i);
    expect(call.text2).not.toMatch(/payment releases/i);
    expect(call.text2).not.toMatch(/approves/i);
    // The truth, plus the step that's actually still outstanding.
    expect(call.text1).toBe('Proof saved');
    expect(call.text2).toMatch(/mark.*complete/i);

    await waitFor(() => expect(goBack).toHaveBeenCalled());
  });
});
