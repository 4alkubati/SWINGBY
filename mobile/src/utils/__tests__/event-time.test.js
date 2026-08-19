/**
 * event-time.test.js — SB-0010.
 *
 * The booking timeline showed "Date confirmed … Logged 1:19 AM" above events
 * logged 1:21, 1:27 and 1:28 AM, with the scheduled service time (a full date,
 * Aug 16 10:13 PM) rendered adjacently. Read top to bottom it said the job was
 * confirmed after it finished.
 *
 * A date on every row would be noise; a date on no row is what caused this.
 * The rule under test: show the date exactly when it is not already obvious
 * from the row above.
 */
const { formatLoggedAt, isSameLocalDay } = require('../eventTime')

const NOW = new Date('2026-08-17T12:00:00')

describe('formatLoggedAt', () => {
  it('shows the date when the day differs from the previous row', () => {
    const out = formatLoggedAt(
      '2026-08-17T01:19:00',
      '2026-08-16T22:13:00',
      NOW,
    )
    expect(out).toMatch(/Aug/)
    expect(out).toMatch(/17/)
  })

  it('omits the date when the previous row is the same day', () => {
    const out = formatLoggedAt(
      '2026-08-17T01:21:00',
      '2026-08-17T01:19:00',
      NOW,
    )
    expect(out).not.toMatch(/Aug/)
  })

  it('omits the date on a first row logged today', () => {
    const out = formatLoggedAt('2026-08-17T09:00:00', null, NOW)
    expect(out).not.toMatch(/Aug/)
  })

  it('shows the date on a first row that is not today', () => {
    const out = formatLoggedAt('2026-08-09T23:36:00', null, NOW)
    expect(out).toMatch(/Aug/)
  })

  it('is empty for a missing or unparseable timestamp', () => {
    expect(formatLoggedAt(null, null, NOW)).toBe('')
    expect(formatLoggedAt('not-a-date', null, NOW)).toBe('')
  })

  it('walks a real sequence the way the screenshot did', () => {
    // Confirmed just after midnight, then the job runs — every row after the
    // first is same-day, so exactly one date appears and the order reads right.
    const events = [
      '2026-08-17T01:19:00',
      '2026-08-17T01:21:00',
      '2026-08-17T01:27:00',
      '2026-08-17T01:28:00',
    ]
    const rendered = events.map((iso, i) =>
      formatLoggedAt(iso, i ? events[i - 1] : null, NOW),
    )
    expect(rendered.filter((r) => /Aug/.test(r))).toHaveLength(0)
    expect(new Set(rendered).size).toBe(4)
  })
})

describe('isSameLocalDay', () => {
  it('is false when either side is missing', () => {
    expect(isSameLocalDay(null, '2026-08-17T01:00:00')).toBe(false)
    expect(isSameLocalDay('2026-08-17T01:00:00', null)).toBe(false)
  })
})
