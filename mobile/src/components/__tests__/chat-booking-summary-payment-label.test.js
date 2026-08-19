/**
 * chat-booking-summary-payment-label.test.js — SB-0001.
 *
 * The booking card at the top of a chat thread read "pending payment · $180"
 * directly above an accepted-quote card reading "$180 paid" — two contradictory
 * states for one booking on one screen.
 *
 * The lowercase, space-separated "pending payment" is the tell: it is the raw
 * `bookings.payment_status` enum with underscores swapped, produced by a
 * `default:` branch that echoed whatever the column held. Any status without an
 * explicit case rendered as a database value in front of a user.
 *
 * These assert the property rather than the list: no label may look like an
 * enum, and every status the backend can write must have a real one.
 */
const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ChatBookingSummary.js'),
  'utf8',
)

// Re-create paymentLabel from source so the test needs no react-native runtime.
function paymentLabel(status) {
  const body = SRC.slice(
    SRC.indexOf('function paymentLabel'),
    SRC.indexOf('function Row'),
  )
  const fn = new Function('status', body + '\nreturn paymentLabel(status);')
  return fn(status)
}

// Every value backend/app/api/*.py writes to bookings.payment_status.
const BACKEND_STATUSES = [
  'pending_payment',
  'held',
  'fully_released',
  'partial_released',
  'refunded',
  'paid_off_platform',
]

describe('payment label', () => {
  it.each(BACKEND_STATUSES)('%s renders a human label, not the enum', (status) => {
    const label = paymentLabel(status)
    expect(label).toBeTruthy()
    expect(label).not.toContain('_')
    expect(label).not.toBe(status.replace(/_/g, ' '))
  })

  it('pending_payment no longer renders as "pending payment"', () => {
    expect(paymentLabel('pending_payment')).toBe('Payment pending')
  })

  it('an unknown status does not leak the raw value', () => {
    expect(paymentLabel('some_future_state')).toBe('Pending')
    expect(paymentLabel(null)).toBe('Pending')
    expect(paymentLabel(undefined)).toBe('Pending')
  })

  it('held still reads as escrow, not as paid', () => {
    // The distinction the whole product rests on: money taken is not money
    // released, and telling a client "Paid" while it is in escrow is the same
    // class of lie in the other direction.
    expect(paymentLabel('held')).toBe('Held in escrow')
    expect(paymentLabel('fully_released')).toBe('Paid')
  })
})
