// Single source of truth for how a BUSINESS booking is grouped into the
// Jobs view's Today / Upcoming / Needs action / Past tabs — and for the
// Dashboard's "today" count and "needs action" chip. Both screens import
// this so the numbers they show always agree with each other (CARD-24).
//
// Backend booking status lifecycle (backend/app/api/bookings.py):
//   confirmed   → booking just created. confirmed_date is ALWAYS null here —
//                 the date handshake (propose-dates / confirm-date) hasn't
//                 happened yet. So EVERY 'confirmed' booking needs the
//                 owner's action, no exceptions.
//   in_progress → set the same instant confirmed_date is written (see
//                 PATCH /bookings/{id}/confirm-date). Only status that ever
//                 carries a real confirmed_date.
//   completed   → done, moves to Past → Invoice.
//   cancelled   → dead, moves to Past (no invoice).

/** True if two Date objects fall on the same calendar day, local time. */
export function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The date a booking is (or would be) scheduled for — confirmed first, else the still-proposed one. */
export function jobDate(booking) {
  const raw = booking?.confirmed_date || booking?.proposed_date_1;
  return raw ? new Date(raw) : null;
}

/**
 * Why a 'confirmed' booking is sitting in Needs Action, most-blocking first.
 * Returns one of: 'unassigned' | 'proposeDate' | 'awaitingDate'.
 */
export function needsActionReason(booking) {
  if (!booking.employee_id) return 'unassigned';
  if (!booking.proposed_date_1) return 'proposeDate';
  return 'awaitingDate';
}

/**
 * Buckets a single booking into 'today' | 'upcoming' | 'needsAction' | 'past'.
 * `now` is injectable for tests; defaults to the real clock.
 */
export function bucketBooking(booking, now = new Date()) {
  if (!booking) return null;
  if (booking.status === 'completed') return 'past';
  if (booking.status === 'cancelled') return 'past';
  if (booking.status === 'confirmed') return 'needsAction';
  if (booking.status === 'in_progress') {
    const d = jobDate(booking);
    // Defensive — the backend contract guarantees confirmed_date is set
    // whenever status is in_progress, but never let a malformed row vanish.
    if (!d) return 'needsAction';
    return isSameLocalDay(d, now) || d < now ? 'today' : 'upcoming';
  }
  // Unknown/legacy status — surface it rather than silently bury it.
  return 'needsAction';
}

/** Ascending by scheduled date; bookings with no date sort last. */
export function byJobDateAsc(a, b) {
  const da = jobDate(a);
  const db = jobDate(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da - db;
}
