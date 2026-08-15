/**
 * D-W8 — a scheduled date that has already gone must not read as upcoming.
 *
 * Screenshot 03 of the 2026-08-13 walkthrough showed a confirmed date of
 * "Sunday, August 9 · 11:36 PM" four days after the fact, presented exactly
 * like a future appointment.
 */

import {
  isPastDue,
  bucketBooking,
  jobDate,
} from '../utils/bookingBuckets';

const NOW = new Date('2026-08-13T22:00:00-06:00');

const at = (iso) => ({ status: 'in_progress', confirmed_date: iso });

describe('isPastDue', () => {
  it('flags the exact booking from the walkthrough', () => {
    expect(isPastDue(at('2026-08-09T23:36:00-06:00'), NOW)).toBe(true);
  });

  it('leaves a future appointment alone', () => {
    expect(isPastDue(at('2026-08-20T09:00:00-06:00'), NOW)).toBe(false);
  });

  it('does not flag a job scheduled earlier today', () => {
    // Today is still today. A 9am job at 10pm is late, not a stale record, and
    // calling it "was scheduled for" while the tradesperson is still on site
    // would be its own kind of wrong.
    expect(isPastDue(at('2026-08-13T09:00:00-06:00'), NOW)).toBe(false);
  });

  it('says nothing about a finished job', () => {
    const b = { status: 'completed', confirmed_date: '2026-08-09T23:36:00-06:00' };
    expect(isPastDue(b, NOW)).toBe(false);
  });

  it('says nothing about a cancelled job', () => {
    const b = { status: 'cancelled', confirmed_date: '2026-08-09T23:36:00-06:00' };
    expect(isPastDue(b, NOW)).toBe(false);
  });

  it('is false when there is no date at all', () => {
    expect(isPastDue({ status: 'confirmed' }, NOW)).toBe(false);
    expect(isPastDue(null, NOW)).toBe(false);
  });

  it('falls back to a merely proposed date', () => {
    const b = { status: 'in_progress', proposed_date_1: '2026-08-09T23:36:00-06:00' };
    expect(isPastDue(b, NOW)).toBe(true);
  });
});

describe('a confirmed booking may already carry a date', () => {
  // interests.py:385 copies preferred_date onto the booking at accept when the
  // client gave a time at posting, skipping the handshake. The docblock in
  // bookingBuckets.js claimed this could never happen.
  it('still needs the owner, but the date is real', () => {
    const b = { status: 'confirmed', confirmed_date: '2026-08-20T09:00:00-06:00' };
    expect(bucketBooking(b, NOW)).toBe('needsAction');
    expect(jobDate(b)).not.toBeNull();
  });
});
