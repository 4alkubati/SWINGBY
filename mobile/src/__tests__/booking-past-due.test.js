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

// Built from LOCAL components, never from an ISO string with a fixed offset.
//
// `isPastDue` leans on `isSameLocalDay`, which is deliberately local-time: a
// tradesperson's "today" is the day on their own phone. Pinning the fixtures to
// -06:00 made the test agree with that only in Calgary — on CI, which runs UTC,
// "2026-08-13T22:00-06:00" is already the 14th, so a 9am job the same Calgary
// morning landed on a different UTC day and the test failed. It passed locally
// and failed in CI, which is the worst way for a timezone bug to present.
const local = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

const NOW = local(2026, 8, 13, 22, 0);

const at = (d) => ({ status: 'in_progress', confirmed_date: d.toISOString() });

describe('isPastDue', () => {
  it('flags the exact booking from the walkthrough', () => {
    expect(isPastDue(at(local(2026, 8, 9, 23, 36)), NOW)).toBe(true);
  });

  it('leaves a future appointment alone', () => {
    expect(isPastDue(at(local(2026, 8, 20, 9, 0)), NOW)).toBe(false);
  });

  it('does not flag a job scheduled earlier today', () => {
    // Today is still today. A 9am job at 10pm is late, not a stale record, and
    // calling it "was scheduled for" while the tradesperson is still on site
    // would be its own kind of wrong.
    expect(isPastDue(at(local(2026, 8, 13, 9, 0)), NOW)).toBe(false);
  });

  it('says nothing about a finished job', () => {
    const b = { status: 'completed', confirmed_date: local(2026, 8, 9, 23, 36).toISOString() };
    expect(isPastDue(b, NOW)).toBe(false);
  });

  it('says nothing about a cancelled job', () => {
    const b = { status: 'cancelled', confirmed_date: local(2026, 8, 9, 23, 36).toISOString() };
    expect(isPastDue(b, NOW)).toBe(false);
  });

  it('is false when there is no date at all', () => {
    expect(isPastDue({ status: 'confirmed' }, NOW)).toBe(false);
    expect(isPastDue(null, NOW)).toBe(false);
  });

  it('falls back to a merely proposed date', () => {
    const b = { status: 'in_progress', proposed_date_1: local(2026, 8, 9, 23, 36).toISOString() };
    expect(isPastDue(b, NOW)).toBe(true);
  });
});

describe('a confirmed booking may already carry a date', () => {
  // interests.py:385 copies preferred_date onto the booking at accept when the
  // client gave a time at posting, skipping the handshake. The docblock in
  // bookingBuckets.js claimed this could never happen.
  it('still needs the owner, but the date is real', () => {
    const b = { status: 'confirmed', confirmed_date: local(2026, 8, 20, 9, 0).toISOString() };
    expect(bucketBooking(b, NOW)).toBe('needsAction');
    expect(jobDate(b)).not.toBeNull();
  });
});
