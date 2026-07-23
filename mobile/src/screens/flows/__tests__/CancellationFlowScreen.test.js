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
