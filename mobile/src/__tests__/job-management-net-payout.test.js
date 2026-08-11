// F090 / F104 regression — JobManagementScreen's Details total, JobRow, and
// PastJobRow all rendered `booking.total_amount` (the client's GROSS charge)
// in success-green, as if it were the business's payout. The business's
// actual take is net of SwingBy's 10% cut, and BusinessInvoicesScreen already
// solved this the right way: read the backend's honest `payment_state` block
// (amount_released, falling back to amount_held) instead of the raw booking
// total. `paidToBusiness()` applies that same fix here.

import { paidToBusiness } from '../screens/business/JobManagementScreen';

describe('paidToBusiness', () => {
  it('prefers amount_released once money has actually gone out', () => {
    const booking = {
      total_amount: 150,
      payment_state: { amount_released: 135, amount_held: 0, amount_total: 150 },
    };
    expect(paidToBusiness(booking)).toBe(135);
  });

  it('falls back to amount_held for a job still mid-flight (nothing released yet)', () => {
    const booking = {
      total_amount: 150,
      payment_state: { amount_released: 0, amount_held: 135, amount_total: 150 },
    };
    expect(paidToBusiness(booking)).toBe(135);
  });

  it('is 0 for an early client cancellation, even though total_amount is nonzero', () => {
    // Client cancels >48h out: 100% refund, business keeps $0 — but
    // total_amount on the booking row is still the original charge.
    const booking = {
      total_amount: 150,
      payment_state: { amount_released: 0, amount_held: 0, amount_total: 150 },
    };
    expect(paidToBusiness(booking)).toBe(0);
  });

  it('never reads booking.total_amount directly', () => {
    // No payment_state at all (e.g. a shape the caller forgot to attach) must
    // not silently fall back to the gross figure.
    const booking = { total_amount: 999 };
    expect(paidToBusiness(booking)).toBe(0);
  });
});
