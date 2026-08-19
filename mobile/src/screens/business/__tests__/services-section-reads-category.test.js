/**
 * services-section-reads-category.test.js — SB-0003.
 *
 * "SERVICES & PRICING" read `business.services`. There is no such column:
 * `businesses` carries category, custom_category and service_radius_km, and
 * onboarding writes exactly one `category`. So the list was always empty and
 * the empty state — "The trades you picked during setup show here." —
 * contradicted the trade printed in the header two rows above it.
 *
 * The section resolves the same way the screen does, so this pins the
 * resolution rather than the rendering.
 */
function resolveServices(business) {
  const explicit = Array.isArray(business?.services) ? business.services : []
  const picked = business?.custom_category || business?.category
  return explicit.length ? explicit : [picked].filter(Boolean)
}

describe('services section', () => {
  it('shows the trade picked at onboarding', () => {
    expect(resolveServices({ category: 'Moving' })).toEqual(['Moving'])
  })

  it('prefers a custom category over the enum', () => {
    expect(
      resolveServices({ category: 'other', custom_category: 'Piano moving' }),
    ).toEqual(['Piano moving'])
  })

  it('is empty only when no category exists at all', () => {
    expect(resolveServices({})).toEqual([])
    expect(resolveServices(null)).toEqual([])
  })

  it('still prefers a real services list when one exists', () => {
    // The array branch is what a future per-service pricing table would fill —
    // the feature the old copy described before it was built.
    const withServices = {
      category: 'Moving',
      services: [{ name: 'Packing', price: 80 }],
    }
    expect(resolveServices(withServices)).toEqual([{ name: 'Packing', price: 80 }])
  })
})

describe('the screen uses this resolution', () => {
  const fs = require('fs')
  const path = require('path')
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'BusinessProfileScreen.js'),
    'utf8',
  )

  it('reads custom_category/category, not just a services column', () => {
    expect(SRC).toMatch(/business\?\.custom_category \|\| business\?\.category/)
  })

  it('no longer RENDERS the promise that setup trades appear there', () => {
    // Comment lines stripped: the fix quotes the old copy to explain what was
    // wrong with it, and that note is worth more than the brevity of this
    // assertion. What must not survive is the sentence being rendered.
    const rendered = SRC.split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
      .join('\n')
    expect(rendered).not.toContain('The trades you picked during setup show here.')
  })
})
