import { clientBookingRoute, paymentOutstanding } from '../clientBookingRoute';

const b = (status, payment_state) => ({ id: 'x', status, payment_state });
const SETTLED = { state: 'held', amount_due: 0 };

describe('clientBookingRoute — PRODUCT-01', () => {
  it('sends an in-flight booking to the live map', () => {
    expect(clientBookingRoute(b('confirmed', SETTLED))).toBe('ActiveBooking');
    expect(clientBookingRoute(b('in_progress', SETTLED))).toBe('ActiveBooking');
  });

  it('sends a finished booking to the record', () => {
    for (const s of ['completed', 'cancelled', 'disputed', 'refunded']) {
      expect(clientBookingRoute(b(s, SETTLED))).toBe('BookingDetails');
    }
  });

  it('is case-insensitive about status', () => {
    expect(clientBookingRoute(b('COMPLETED', SETTLED))).toBe('BookingDetails');
  });

  // The trap the handoff warned about: "Pay with card" exists ONLY on
  // BookingDetailsScreen. Routing an unpaid client to the map would remove the
  // only way to pay, and escrow would never capture.
  it('keeps an unpaid booking on the screen that can take payment', () => {
    expect(clientBookingRoute(b('confirmed', { state: 'unpaid', amount_due: 180 })))
      .toBe('BookingDetails');
    expect(clientBookingRoute(b('in_progress', { state: 'held', amount_due: 40 })))
      .toBe('BookingDetails');
  });

  it('treats a missing payment_state as settled, not as owing', () => {
    // A false "you owe money" would push every client to the wrong screen.
    expect(clientBookingRoute(b('in_progress', undefined))).toBe('ActiveBooking');
    expect(paymentOutstanding(b('in_progress', undefined))).toBe(false);
  });

  it('does not crash on a malformed booking', () => {
    expect(clientBookingRoute(undefined)).toBe('ActiveBooking');
    expect(clientBookingRoute({})).toBe('ActiveBooking');
  });
});
