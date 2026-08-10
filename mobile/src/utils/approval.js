// Single source of truth for "this job is finished and the client's money is
// waiting on them" — the state Kira's 2026-08-06 walkthrough found nowhere on
// the client's screens while a 24-hour timer counted down against it.
//
// Two surfaces read it (client Home's prompt card, My Jobs' Past row) and they
// must agree: a row badged "Needs your OK" that Home does not prompt for, or
// the reverse, is the same class of contradiction the walkthrough was about.
//
// WHAT OPENS THE WINDOW. The business marking a job complete
// (PATCH /bookings/{id}/complete) sets status='completed', LEAVES the money
// held, and writes `approval_deadline_at` 24h out. The client approving
// (POST /bookings/{id}/approve) releases it early; if nobody does,
// services/approvals.py releases it when the deadline passes. See the long
// comment in bookings.py::complete_booking for why completing no longer pays
// the business itself.
//
// WHY payment_state AND NOT payment_status. `payment_state` is derived from
// the payments ledger by bookings.py::_payment_state and attached to every
// booking read, list included. The raw `payment_status` column can say 'held'
// with no Stripe capture behind it — production holds 24 such rows — and
// prompting someone to release money that was never collected is worse than
// not prompting at all.

/** True when the pro says the job is done and the client's escrow is still held. */
export function isAwaitingApproval(booking) {
  return (
    booking?.status === 'completed' &&
    booking?.payment_state?.state === 'held' &&
    !!booking?.approval_deadline_at
  );
}

/**
 * Whole hours left on the approval window, rounded up. `null` if there is no
 * usable deadline, `0` once it has passed.
 *
 * Never negative: the auto-release is a cron, so a booking can sit here with
 * the money still held for a few minutes after its window closed, and
 * "releases in -1h" is not a thing to say to someone about their money.
 */
export function hoursUntilApproval(booking) {
  const raw = booking?.approval_deadline_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 3600000));
}
