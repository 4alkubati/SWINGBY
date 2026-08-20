/**
 * job-opportunity-area.test.js — the quadrant a business sees before quoting.
 *
 * The backend masks a full address down to everything after the first comma,
 * so "3823 16 St SW, Calgary, AB" becomes "Calgary, AB". In Canadian
 * addressing the quadrant sits BEFORE that comma, so masking discarded the one
 * piece of geography a business uses to decide whether a job is a ten-minute
 * drive or a thirty-minute one — and every post in the feed looked identical.
 *
 * privacy.py now emits `area` separately. This pins how the card combines the
 * two, including the case the fail-closed masking creates: a free-typed
 * address has no comma, masks to null, and the post still has a quadrant.
 */
const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'JobOpportunityCard.js'),
  'utf8',
)

// Mirror of the card's expression, so the test pins the rule rather than JSX.
const line = (post) => [post.address, post.area].filter(Boolean).join(' · ')

describe('job card location line', () => {
  it('shows locality and quadrant together', () => {
    expect(line({ address: 'Calgary, AB', area: 'SW' })).toBe('Calgary, AB · SW')
  })

  it('shows the quadrant alone when the address masked to null', () => {
    // "143 Citadel Meadow Gardens NW" — no comma, so the address fails closed.
    expect(line({ address: null, area: 'NW' })).toBe('NW')
  })

  it('shows the locality alone when there is no quadrant', () => {
    // Out of town, or a city-only address.
    expect(line({ address: 'Orillia, ON, Canada', area: null })).toBe(
      'Orillia, ON, Canada',
    )
  })

  it('renders nothing when neither is known', () => {
    expect(line({ address: null, area: null })).toBe('')
  })

  it('the card actually reads post.area', () => {
    expect(SRC).toMatch(/post\.area/)
  })

  it('the card still never renders a street address field', () => {
    // The masking happens server-side; this guards against someone adding a
    // raw street field to the card later.
    expect(SRC).not.toMatch(/post\.street|post\.full_address/)
  })
})
