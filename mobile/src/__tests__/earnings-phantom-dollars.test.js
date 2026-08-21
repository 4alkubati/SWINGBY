/**
 * SB-0099 — EarningsScreen must not resurrect the phantom dollars.
 *
 * GET /payments/mine deliberately keeps unverified rows out of its own totals:
 * 24 production rows read 'fully_released' with no PaymentIntent behind them,
 * $4,675.50 of payouts nobody ever paid. EarningsScreen threw those totals away
 * and re-summed the raw `items` to get a date-range figure, which put every
 * phantom row straight back into the business's headline earnings.
 *
 * It also rendered `payments.length` under the label "Completed Jobs" — but a
 * payments row is created the moment a quote is accepted, so every job still in
 * progress counted as finished.
 */
import { aggregateStats } from '../screens/business/EarningsScreen';

const captured = (over = {}) => ({
  released_to_business: 90,
  escrow_held: 0,
  platform_cut: 10,
  status: 'fully_released',
  was_ever_captured: true,
  is_capture_backed: false,
  ...over,
});

const phantom = (over = {}) => ({
  released_to_business: 4675.5,
  escrow_held: 0,
  platform_cut: 0,
  status: 'fully_released',
  was_ever_captured: false,
  is_capture_backed: false,
  ...over,
});

describe('aggregateStats', () => {
  it('leaves a phantom released row out of the headline total', () => {
    const stats = aggregateStats([captured(), phantom()]);
    expect(stats.total).toBe(90);
  });

  it('counts only completed jobs, not every payments row', () => {
    const stats = aggregateStats([
      captured(),
      // accepted and paid, work still in progress — a row exists already
      captured({ status: 'held', released_to_business: 0, is_capture_backed: true }),
    ]);
    expect(stats.count).toBe(1);
  });

  it('counts escrow only when a capture stands behind it', () => {
    const stats = aggregateStats([
      captured({ status: 'held', escrow_held: 150, released_to_business: 0, is_capture_backed: true }),
      // ledger says held, nobody was ever charged — the size of the lie
      captured({ status: 'held', escrow_held: 999, released_to_business: 0, is_capture_backed: false }),
    ]);
    expect(stats.pending).toBe(150);
  });

  it('treats rows from an older backend as unverified rather than inventing money', () => {
    const legacy = { released_to_business: 500, escrow_held: 0, platform_cut: 0, status: 'fully_released' };
    const stats = aggregateStats([legacy]);
    expect(stats.total).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('still returns zeroes for an empty ledger', () => {
    expect(aggregateStats([])).toEqual({ total: 0, count: 0, avg: 0, pending: 0, fees: 0 });
  });
});
