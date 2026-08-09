// booking-events-duplicate-complete.test.js — walkthrough bug 10.
//
// The booking timeline showed two rows both titled "Job complete". They are
// different real events sharing the same booking_events.event_type:
//
//   - backend/app/services/approvals.py::start_approval_window writes
//     event_type 'completed' when the BUSINESS marks the job done.
//   - backend/app/api/proof_of_work.py::approve_proof writes its OWN
//     event_type 'completed' row when the CLIENT approves proof and the
//     payment releases — its note always contains "payment released", which
//     no "mark done" note ever does. (approvals.release() also writes a
//     genuine event_type 'payment_released' row for the same moment, covered
//     here too.)
//
// Both renderers of booking_events — the client BookingDetailsScreen timeline
// and the shared LiveStatusTimeline used on the business side — must tell the
// two 'completed' rows apart using the note, and must label the real
// 'payment_released' event_type accurately rather than falling through to a
// generic/raw-enum fallback.

import React from 'react';
import { render } from '@testing-library/react-native';

import { eventTitle, eventIcon } from '../screens/client/BookingDetailsScreen';
import LiveStatusTimeline from '../components/LiveStatusTimeline';
import i18n from '../i18n';

const MARK_DONE_NOTE =
  'Work marked done. Waiting for the client to approve; releases automatically after 24h.';
const APPROVE_NOTE = 'Client approved the proof of work — payment released';
const AUTO_RELEASE_NOTE = 'No response within 24h — payment released automatically.';

describe('BookingDetailsScreen — eventTitle/eventIcon disambiguate the two "completed" rows', () => {
  it('labels the business "mark done" completed row as "Job complete"', () => {
    expect(eventTitle('completed', MARK_DONE_NOTE)).toBe(i18n.t('booking.eventCompleted'));
  });

  it('labels the client-approval completed row as "Payment released", not "Job complete"', () => {
    expect(eventTitle('completed', APPROVE_NOTE)).toBe(i18n.t('booking.eventPaymentReleased'));
    expect(eventTitle('completed', APPROVE_NOTE)).not.toBe(i18n.t('booking.eventCompleted'));
  });

  it('gives the two rows different icons too', () => {
    expect(eventIcon('completed', MARK_DONE_NOTE)).not.toBe(eventIcon('completed', APPROVE_NOTE));
  });

  it('labels the real payment_released event_type accurately, not as "Booking updated"', () => {
    expect(eventTitle('payment_released', AUTO_RELEASE_NOTE)).toBe(
      i18n.t('booking.eventPaymentReleased'),
    );
  });

  it('leaves a plain "completed" row with no note reading as "Job complete"', () => {
    expect(eventTitle('completed', undefined)).toBe(i18n.t('booking.eventCompleted'));
  });
});

describe('LiveStatusTimeline — same disambiguation on the business side', () => {
  it('does not render "Job complete" twice for a booking that went through the full approval flow', () => {
    const events = [
      { id: 'e1', event_type: 'completed', note: MARK_DONE_NOTE, created_at: '2026-08-01T10:00:00Z' },
      { id: 'e2', event_type: 'completed', note: APPROVE_NOTE, created_at: '2026-08-02T09:00:00Z' },
    ];
    const { getAllByText, getByText } = render(
      <LiveStatusTimeline events={events} status="ready" />,
    );

    expect(getAllByText('Job complete')).toHaveLength(1);
    expect(getByText('Payment released')).toBeTruthy();
  });
});
