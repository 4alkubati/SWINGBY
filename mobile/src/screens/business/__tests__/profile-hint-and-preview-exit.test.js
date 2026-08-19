/**
 * profile-hint-and-preview-exit.test.js — SB-0002 and SB-0004.
 *
 * Both are single-line facts about one screen's source, and both are the kind
 * of thing that silently reverts: a `numberOfLines={1}` added back during a
 * layout tidy, or the headerLeft override dropped in a navigation refactor.
 * Asserting them against the source is cheap and catches exactly that.
 *
 * SB-0002 — the completeness card clipped its hint mid-word ("80% — Add a
 * description t…"). The percentage is decoration; the tip is the instruction,
 * so the clip removed the only actionable half, with no expand and no
 * tap-through to reach the rest.
 *
 * SB-0004 — entering "Preview public" showed the purple banner's Done action
 * AND the navigator's back arrow directly beneath it. Two exits from one modal
 * state that do different things: Done returns to the management view, back
 * leaves the screen entirely and strands the owner outside a mode they never
 * left.
 */
const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'BusinessProfileScreen.js'),
  'utf8',
)

describe('SB-0002 — the completeness hint is readable', () => {
  it('does not clip the tip to one line', () => {
    // Comment lines are stripped first: the fix's own comment quotes the old
    // `numberOfLines={1}` to explain why it is wrong, and that explanation is
    // the thing most likely to stop it being re-added during a layout tidy.
    const card = SRC.slice(
      SRC.indexOf('Profile completeness'),
      SRC.indexOf('Services & pricing'),
    )
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
      .join('\n')

    expect(card).toContain('${pct}% — ${tip}')
    expect(card).not.toMatch(/numberOfLines=\{1\}/)
    expect(card).toMatch(/numberOfLines=\{2\}/)
  })
})

describe('SB-0004 — preview mode has one exit', () => {
  it('hides the navigator back arrow while previewing', () => {
    expect(SRC).toMatch(/headerLeft:\s*previewPublic\s*\?\s*\(\)\s*=>\s*null/)
  })

  it('restores it when the preview ends', () => {
    // `undefined` gives the header back to the navigator's default rather than
    // pinning a custom one — leaving a null headerLeft behind would remove the
    // back arrow from the normal management view too.
    expect(SRC).toMatch(/headerLeft:\s*previewPublic\s*\?\s*\(\)\s*=>\s*null\s*:\s*undefined/)
  })

  it('keeps Done as the affordance the banner offers', () => {
    expect(SRC).toContain('Exit public preview')
  })
})
