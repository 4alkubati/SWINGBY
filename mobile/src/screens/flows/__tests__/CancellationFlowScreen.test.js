import { classifyTiming, computePenalty, CLIENT_CANCEL_PCT } from '../CancellationFlowScreen';

// These figures are the CLIENT-cancel column of the ToS ladder implemented in
// backend/app/services/escrow.py (compute_cancellation_split, ruling
// 2026-07-21). If the backend ladder moves, this test must move with it —
// that is the point: the client must never be quoted a fee the server won't
// charge. The pre-fix code quoted 25% to clients owed a full refund.
const HOUR = 3600000;
const NOW = Date.parse('2026-07-22T12:00:00Z');
const iso = (hoursFromNow) => new Date(NOW + hoursFromNow * HOUR).toISOString();

describe('cancellation timing buckets', () => {
  it('classifies >48h out as early', () => {
    expect(classifyTiming(iso(72), NOW)).toBe('early');
  });
  it('classifies exactly 48h as late (boundary is inclusive, like the server)', () => {
    expect(classifyTiming(iso(48), NOW)).toBe('late');
  });
  it('classifies 0-48h out as late', () => {
    expect(classifyTiming(iso(5), NOW)).toBe('late');
  });
  it('classifies a past date as no_show', () => {
    expect(classifyTiming(iso(-1), NOW)).toBe('no_show');
  });
  it('classifies a missing or unparseable date as no_date', () => {
    expect(classifyTiming(null, NOW)).toBe('no_date');
    expect(classifyTiming('not-a-date', NOW)).toBe('no_date');
  });
});

describe('client cancellation penalty matches the server ladder', () => {
  it('charges nothing more than 48h out (full refund)', () => {
    const { pct, amount } = computePenalty(iso(72), 200, NOW);
    expect(pct).toBe(0);
    expect(amount).toBe(0);
  });

  it('charges 25% within 48h', () => {
    const { pct, amount } = computePenalty(iso(5), 200, NOW);
    expect(pct).toBe(0.25);
    expect(amount).toBe(50);
  });

  it('charges 50% for a no-show', () => {
    const { pct, amount } = computePenalty(iso(-2), 200, NOW);
    expect(pct).toBe(0.5);
    expect(amount).toBe(100);
  });

  it('charges nothing when no date is confirmed yet', () => {
    expect(computePenalty(null, 200, NOW)).toMatchObject({ pct: 0, amount: 0 });
  });

  it('never quotes a fee to a client the server would refund in full', () => {
    expect(CLIENT_CANCEL_PCT.early).toBe(0);
    expect(CLIENT_CANCEL_PCT.no_date).toBe(0);
  });

  it('treats a missing/garbage price as $0 rather than NaN', () => {
    expect(computePenalty(iso(5), undefined, NOW).amount).toBe(0);
    expect(computePenalty(iso(5), 'abc', NOW).amount).toBe(0);
  });
});

// ─── business side ────────────────────────────────────────────────────────────
// The BUSINESS-cancel column of the same ladder (escrow.py, `actor ==
// "business"`). Until 2026-07-30 nothing in the app could reach this half: the
// flow was client-only and CancellationFlow was not registered in
// BusinessNavigator, so every business penalty and every goodwill credit in the
// published Terms was unreachable. Same tiers as the client column, but the
// meaning is inverted — the client is always made whole and the percentage is
// charged AGAINST the provider.
describe('business cancellation matches the server ladder', () => {
  const biz = (hours, price = 200) => computePenalty(iso(hours), price, NOW, 'business');

  it('refunds the client in full at every tier', () => {
    for (const hours of [72, 5, -2]) {
      expect(biz(hours).clientRefund).toBe(200);
    }
    expect(computePenalty(null, 200, NOW, 'business').clientRefund).toBe(200);
  });

  it('charges the business nothing more than 48h out', () => {
    expect(biz(72)).toMatchObject({ timing: 'early', pct: 0, amount: 0, credit: 0 });
  });

  it('charges the business 25% inside 48h, plus a goodwill credit', () => {
    expect(biz(5)).toMatchObject({ timing: 'late', pct: 0.25, amount: 50, credit: 25 });
  });

  it('charges the business 50% after the date has passed, plus a credit', () => {
    expect(biz(-2)).toMatchObject({ timing: 'no_show', pct: 0.5, amount: 100, credit: 25 });
  });

  it('charges nothing when no date was ever confirmed', () => {
    expect(computePenalty(null, 200, NOW, 'business')).toMatchObject({
      pct: 0,
      amount: 0,
      credit: 0,
    });
  });

  it('never grants a goodwill credit on a CLIENT cancel', () => {
    // The credit exists to compensate a client let down by a provider. A client
    // who cancels on themselves is not owed one.
    for (const hours of [72, 5, -2]) {
      expect(computePenalty(iso(hours), 200, NOW, 'client').credit).toBe(0);
    }
  });

  it('defaults to the client ladder when no actor is given', () => {
    // Every existing caller omits the argument; defaulting to 'business' would
    // silently quote the wrong figures to clients.
    expect(computePenalty(iso(5), 200, NOW)).toMatchObject({ pct: 0.25, credit: 0 });
  });

  it('leaves the client keeping the remainder on a client cancel', () => {
    expect(computePenalty(iso(5), 200, NOW, 'client').clientRefund).toBe(150);
  });
});
