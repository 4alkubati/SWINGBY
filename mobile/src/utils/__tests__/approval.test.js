// The predicate behind client Home's "needs your OK" card and My Jobs' Past
// row badge. It is shared precisely so those two cannot drift, so it is worth
// pinning on its own: every wrong answer here is either a prompt to release
// money that was never collected, or silence while a 24h timer runs.
import { isAwaitingApproval, hoursUntilApproval } from '../approval';

const IN_20H = () => new Date(Date.now() + 20 * 3600 * 1000).toISOString();

function booking(overrides = {}) {
  return {
    id: 'bk-1',
    status: 'completed',
    approval_deadline_at: IN_20H(),
    payment_state: { state: 'held', capture_backed: true, amount_held: 195 },
    ...overrides,
  };
}

describe('isAwaitingApproval', () => {
  it('is true for a finished job whose escrow is still held', () => {
    expect(isAwaitingApproval(booking())).toBe(true);
  });

  it('is false once the money is released', () => {
    expect(
      isAwaitingApproval(
        booking({ payment_state: { state: 'released' }, approval_deadline_at: null }),
      ),
    ).toBe(false);
  });

  it('is false when nothing was ever captured', () => {
    // A payments row can claim 'held' with no PaymentIntent behind it —
    // production holds 24 such rows. _payment_state fails those closed to
    // 'unpaid', and prompting someone to release money nobody collected is
    // worse than not prompting.
    expect(
      isAwaitingApproval(booking({ payment_state: { state: 'unpaid', capture_backed: false } })),
    ).toBe(false);
  });

  it('is false while the job is still running', () => {
    expect(isAwaitingApproval(booking({ status: 'in_progress' }))).toBe(false);
  });

  it('is false with no approval window open', () => {
    expect(isAwaitingApproval(booking({ approval_deadline_at: null }))).toBe(false);
  });

  it('survives a missing booking and a missing payment_state', () => {
    expect(isAwaitingApproval(undefined)).toBe(false);
    expect(isAwaitingApproval({ status: 'completed' })).toBe(false);
  });
});

describe('hoursUntilApproval', () => {
  it('rounds up, so 19h05m left reads as 20h rather than 19h', () => {
    expect(hoursUntilApproval(booking())).toBe(20);
  });

  it('never goes negative — the auto-release is a cron, not an instant', () => {
    const past = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    expect(hoursUntilApproval(booking({ approval_deadline_at: past }))).toBe(0);
  });

  it('is null when there is no usable deadline', () => {
    expect(hoursUntilApproval(booking({ approval_deadline_at: null }))).toBeNull();
    expect(hoursUntilApproval(booking({ approval_deadline_at: 'not a date' }))).toBeNull();
  });
});
