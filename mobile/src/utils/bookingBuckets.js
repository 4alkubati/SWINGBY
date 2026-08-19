// Single source of truth for how a BUSINESS booking is grouped into the
// Jobs view's Today / Upcoming / Needs action / Past tabs — and for the
// Dashboard's "today" count and "needs action" chip. Both screens import
// this so the numbers they show always agree with each other (CARD-24).
//
// Backend booking status lifecycle (backend/app/api/bookings.py):
//   confirmed   → booking just created. MAY already carry a confirmed_date:
//                 when the client gave a time at posting, interests.py:385
//                 copies preferred_date straight onto the booking and the
//                 propose/confirm handshake is skipped entirely. Otherwise it
//                 is null and the owner has to act.
//   in_progress → set the same instant confirmed_date is written (see
//                 PATCH /bookings/{id}/confirm-date).
//   completed   → done, moves to Past → Invoice.
//   cancelled   → dead, moves to Past (no invoice).
//
// ⚠ The first entry used to read "confirmed_date is ALWAYS null here — the
// date handshake hasn't happened yet. So EVERY 'confirmed' booking needs the
// owner's action, no exceptions." That stopped being true the day the
// preferred-date path shipped, and it is the kind of stale comment that makes
// the next person write a wrong guard. Corrected 2026-08-14 (D-W8).

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
 * Returns 'unassigned' | 'proposeDate' | 'awaitingDate', or null when nothing
 * is actually blocked on the owner.
 *
 * SB-0006 — this used to ask only about `proposed_date_1`. When the client
 * gives a time at posting, interests.py copies it straight to `confirmed_date`
 * and the propose/confirm handshake never happens, so `proposed_date_1` is
 * null and this returned 'proposeDate'. The owner was told to schedule a job
 * the client's own screen already showed as CONFIRMED — the two screens
 * disagreeing about one booking.
 *
 * The lifecycle comment at the top of this file was corrected on 2026-08-14 to
 * record exactly that path, and warns that a stale comment here "makes the next
 * person write a wrong guard". This guard was written before the correction.
 * `confirmed_date` is the field the client's CONFIRMED badge reads, so it is
 * the field this must read too.
 */
export function needsActionReason(booking) {
  if (!booking.employee_id) return 'unassigned';
  // The date is settled — however it got settled. Nothing to propose, and
  // nobody to wait for.
  if (booking.confirmed_date) return null;
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
  if (booking.status === 'confirmed') {
    // SB-0006 — a 'confirmed' booking is only Needs Action while something is
    // genuinely blocked on the owner. One that arrived with the client's own
    // time AND has someone assigned is simply scheduled; leaving it here is how
    // a "Needs action" list fills with rows that need no action and stops being
    // read at all.
    if (needsActionReason(booking) === null) {
      const d = jobDate(booking);
      if (!d) return 'needsAction';
      return isSameLocalDay(d, now) || d < now ? 'today' : 'upcoming';
    }
    return 'needsAction';
  }
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

/**
 * True when a booking's scheduled date has already passed and the job is still
 * live (not completed, not cancelled).
 *
 * D-W8 — screenshot 03 showed a confirmed date of "Sunday, August 9 · 11:36 PM"
 * four days after the fact, presented exactly like an upcoming appointment. The
 * business view already handled this (`bucketBooking` folds a past date into
 * 'today'), but the client view rendered the raw date with no acknowledgement
 * that it was behind them — so the app looked like it was waiting for a moment
 * that had already gone.
 *
 * `now` is injectable for tests, like everything else in this file.
 */
export function isPastDue(booking, now = new Date()) {
  if (!booking) return false;
  if (booking.status === 'completed' || booking.status === 'cancelled') return false;
  const d = jobDate(booking);
  return !!d && d < now && !isSameLocalDay(d, now);
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
