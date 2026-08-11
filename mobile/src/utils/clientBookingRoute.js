// clientBookingRoute.js — which booking screen a CLIENT should land on.
//
// PRODUCT-01, as specified by Kira 2026-08-11: while the job is running the
// client sees the live map ("Service in progress" — ActiveBookingScreen), NOT
// the record view. Once the job is finished, the record IS the useful thing, so
// it flips to BookingDetailsScreen.
//
//   in flight   -> ActiveBooking   (where is my worker, what stage are we at)
//   finished    -> BookingDetails  (what happened, what did it cost, receipt)
//
// WHY THIS IS A HELPER AND NOT AN `if` AT EACH CALLSITE
// ----------------------------------------------------
// Six places navigate a client into a booking (MyJobs, MyDisputes, ChatScreen
// x3, ActiveBooking's own "View full details"). The 2026-08-09 handoff called
// out that a previous attempt at this stalled precisely because the rule was
// going to be duplicated at each of them. One definition, one test.
//
// THE TRAP THIS DELIBERATELY AVOIDS
// ---------------------------------
// "Pay with card" exists ONLY on BookingDetailsScreen (:916) — ActiveBooking
// links across to it (:766) and has no pay CTA of its own. So routing a client
// away from BookingDetails while they still owe money would remove the only
// way to pay, and escrow would never capture. Until a pay CTA exists on
// ActiveBooking, an unsettled booking keeps going to the record view.
//
// That is not a softening of the spec: a booking that has not been paid for is
// not "in progress" in the sense the spec is about — nobody is on their way to
// anything yet. Revisit this the moment ActiveBooking can take a payment.

// Anything past the job itself. `cancelled` and `disputed` belong here too:
// there is no live tracking to show, and the record is what the client needs.
const FINISHED = new Set(['completed', 'cancelled', 'disputed', 'refunded']);

/**
 * @param {object} booking - needs `status`, and `payment_state` when available.
 * @returns {'ActiveBooking'|'BookingDetails'}
 */
export function clientBookingRoute(booking) {
  const status = String(booking?.status || '').toLowerCase();

  if (FINISHED.has(status)) return 'BookingDetails';

  // Still owed money -> the only screen that can take it.
  if (paymentOutstanding(booking)) return 'BookingDetails';

  return 'ActiveBooking';
}

/**
 * True when the client still has something to pay. Reads the backend's own
 * payment_state block (bookings.py::_payment_state) rather than re-deriving
 * from booking fields — `amount_due` is the server's answer to this exact
 * question. Absent payment_state we assume settled: a false "you owe money"
 * would push every client to the wrong screen, while a false "settled" only
 * costs one extra tap on "View full details", which stays on the map screen.
 */
export function paymentOutstanding(booking) {
  const ps = booking?.payment_state;
  if (!ps) return false;
  if (ps.state === 'unpaid') return true;
  return Number(ps.amount_due || 0) > 0;
}

export const FINISHED_STATUSES = FINISHED;
