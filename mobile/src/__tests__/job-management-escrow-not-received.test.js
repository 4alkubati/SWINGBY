/**
 * D19 — held escrow is not a received, netted payout.
 *
 * The F090/F104 fix replaced the client's gross `total_amount` with the
 * backend's payment_state, which was right, but it collapsed
 * `released || held` into ONE number that every caller painted success-green.
 * That is only true of `amount_released`. `amount_held` is the client's money
 * sitting in escrow, and it is still GROSS — the 10% platform cut comes out
 * when it releases — so green claimed "received" and "netted" about a figure
 * that was neither.
 *
 * `payment_state` deliberately exposes no platform_cut (see
 * backend/app/api/bookings.py::_payment_state), so the app must NOT try to net
 * it itself: hardcoding 10% would fork escrow.PLATFORM_RATE into the client,
 * which is exactly how these numbers drifted apart before. Report the state
 * truthfully instead.
 */
import { businessAmount, paidToBusiness } from '../screens/business/JobManagementScreen';

const booking = (payment_state) => ({ id: 'b1', total_amount: 200, payment_state });

describe('businessAmount', () => {
  it('reports released money as received', () => {
    const r = businessAmount(booking({ amount_released: 90, amount_held: 0 }));
    expect(r).toEqual({ amount: 90, received: true });
  });

  it('reports held escrow as NOT received', () => {
    const r = businessAmount(booking({ amount_released: 0, amount_held: 100 }));
    expect(r.amount).toBe(100);
    expect(r.received).toBe(false);
  });

  it('prefers released over held once money has actually moved', () => {
    const r = businessAmount(booking({ amount_released: 90, amount_held: 100 }));
    expect(r).toEqual({ amount: 90, received: true });
  });

  it('never reports the client gross charge as the business figure', () => {
    // total_amount is 200; the business must never see that number here.
    expect(businessAmount(booking({ amount_released: 0, amount_held: 100 })).amount).not.toBe(200);
    expect(businessAmount(booking({ amount_released: 90, amount_held: 0 })).amount).not.toBe(200);
  });

  it('treats a missing payment_state as nothing to show, not as zero received', () => {
    const r = businessAmount({ id: 'b1', total_amount: 200 });
    expect(r).toEqual({ amount: 0, received: false });
  });

  it('keeps paidToBusiness as the value-only form', () => {
    expect(paidToBusiness(booking({ amount_released: 0, amount_held: 100 }))).toBe(100);
    expect(paidToBusiness(booking({ amount_released: 90, amount_held: 100 }))).toBe(90);
  });
});

describe('the rendered claim', () => {
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '../screens/business/JobManagementScreen.js'),
    'utf8',
  );

  it('never paints an amount success-green unconditionally', () => {
    // The bug was `color: colors.success` on a figure that could be escrow.
    // Every money colour on this screen must now branch on `received`.
    const unconditionalGreen = /color:\s*colors\.success,\s*fontFamily:\s*'SpaceGrotesk_700Bold'/g;
    expect(source.match(unconditionalGreen)).toBeNull();
  });

  it('labels un-released money as held rather than paid out', () => {
    expect(source).toMatch(/in escrow|' held'/);
  });
});
