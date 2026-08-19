/**
 * needs-action-date-settled.test.js — SB-0006.
 *
 * The walkthrough caught one booking described two ways at once: the client's
 * thread showed CONFIRMED with "Sun, Aug 9, 11:36 PM", while the business's
 * Jobs -> Needs action list still offered a "Propose a time" pill for it.
 *
 * The cause is in bookingBuckets.js, and the file already contains the fact
 * that explains it. Its lifecycle comment was corrected on 2026-08-14 to say:
 *
 *   confirmed -> booking just created. MAY already carry a confirmed_date:
 *   when the client gave a time at posting, interests.py copies preferred_date
 *   straight onto the booking and the propose/confirm handshake is SKIPPED.
 *
 * `bucketBooking` was updated for that. `needsActionReason` never was — it asks
 * only about `proposed_date_1`, so a booking whose date was settled at posting
 * has no proposal, falls to 'proposeDate', and the owner is asked to schedule a
 * job that is already scheduled.
 *
 * The stale-comment note in that file warns about exactly this failure ("the
 * kind of stale comment that makes the next person write a wrong guard"). The
 * guard was written before the comment was corrected.
 */
const {
  needsActionReason,
  bucketBooking,
} = require('../utils/bookingBuckets')

const CONFIRMED_AT_POSTING = {
  status: 'confirmed',
  employee_id: 'emp-1',
  confirmed_date: '2026-08-09T23:36:00Z',
  proposed_date_1: null,
}

describe('a date settled at posting is not a date to propose', () => {
  it('does not ask the owner to propose a time', () => {
    expect(needsActionReason(CONFIRMED_AT_POSTING)).not.toBe('proposeDate')
  })

  it('does not ask them to wait on a proposal either', () => {
    // 'awaitingDate' would be just as wrong — nobody is waiting; the client
    // already gave the time and the client's own screen says CONFIRMED.
    expect(needsActionReason(CONFIRMED_AT_POSTING)).not.toBe('awaitingDate')
  })

  it('still asks for an assignment when there is no employee', () => {
    expect(
      needsActionReason({ ...CONFIRMED_AT_POSTING, employee_id: null }),
    ).toBe('unassigned')
  })

  it('still asks to propose when the date genuinely is not settled', () => {
    expect(
      needsActionReason({
        status: 'confirmed',
        employee_id: 'emp-1',
        confirmed_date: null,
        proposed_date_1: null,
      }),
    ).toBe('proposeDate')
  })

  it('still waits when a proposal is out and unanswered', () => {
    expect(
      needsActionReason({
        status: 'confirmed',
        employee_id: 'emp-1',
        confirmed_date: null,
        proposed_date_1: '2026-08-20T10:00:00Z',
      }),
    ).toBe('awaitingDate')
  })

  it('a fully settled booking leaves Needs action entirely', () => {
    // Assigned AND dated is not blocked on the owner for anything. Leaving it
    // in Needs action is how that list stops meaning anything.
    const now = new Date('2026-08-08T12:00:00Z')
    expect(bucketBooking(CONFIRMED_AT_POSTING, now)).not.toBe('needsAction')
  })

  it('an unassigned booking stays in Needs action even with a date', () => {
    const now = new Date('2026-08-08T12:00:00Z')
    expect(
      bucketBooking({ ...CONFIRMED_AT_POSTING, employee_id: null }, now),
    ).toBe('needsAction')
  })
})
