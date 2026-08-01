// Sentinel sweep, 2026-08-01 — the mobile half.
//
// Three numbers the app stated confidently and could not back up.

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Source assertions must match CODE, not the comments explaining the fix.
// Every one of these findings is documented in a comment that names the old
// wrong value, so a naive substring check fails on the explanation itself.
const code = (p) =>
  read(p)
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

describe('the notification bell no longer claims permanent new activity', () => {
  // The bell rendered an accent dot UNCONDITIONALLY — "you have something new"
  // on every launch, forever, with no unread state behind it and no way to
  // clear it. NotificationsScreen builds its list from bookings and posts and
  // has no read/unread concept at all, so there was nothing truthful to gate
  // the dot on; it is gone rather than faked.
  const home = code('screens/client/HomeScreen.js');

  it('renders no dot', () => {
    expect(home).not.toMatch(/<View style={styles\.notifDot}/);
  });

  it('leaves no orphaned style behind', () => {
    expect(home).not.toMatch(/notifDot:\s*{/);
  });

  it('still has the bell', () => {
    expect(home).toMatch(/name="bell"/);
  });
});

describe('discovery screens stop calling reviews "jobs"', () => {
  // review_count is how many people left a review — always <= completed jobs,
  // since reviewing is optional. The business's own Dashboard labels the same
  // field "reviews"; four client screens called it "jobs".
  it.each([
    ['screens/client/HomeScreen.js'],
    ['screens/client/SearchScreen.js'],
    ['screens/client/FavoritesScreen.js'],
    ['screens/client/NearbyMapScreen.js'],
  ])('%s does not pass review_count as a jobs count', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/jobs=\{[^}]*review_count/);
    expect(src).not.toMatch(/review_count\}\s*jobs/);
  });

  it.each([['components/FeaturedCard.js'], ['components/NearbyCard.js']])(
    '%s renders the count as reviews',
    (file) => {
      const src = read(file);
      expect(src).toMatch(/reviews/);
      expect(src).not.toMatch(/\{jobs\}\s*jobs/);
    },
  );
});

describe('the map card never invents a count', () => {
  // '12 pros near you' was the fallback whenever the list was empty — including
  // before the fetch resolved, since the card is not gated on loading. It
  // advertised 12 pros directly above a "No businesses nearby" empty state.
  it('HomeScreen shows a neutral label instead of a number', () => {
    const home = code('screens/client/HomeScreen.js');
    expect(home).not.toMatch(/'12 pros near you'/);
    expect(home).toMatch(/Explore the map/);
  });

  it('MapPreviewCard defaults to no number at all', () => {
    const card = code('components/MapPreviewCard.js');
    expect(card).not.toMatch(/countLabel = '12 pros near you'/);
  });
});

describe('the dashboard earnings hero (already fixed in PR #82)', () => {
  // Sentinel swept 80ffb75, which predates the fix. Pinned here so the finding
  // is answered rather than left looking open: the hero reads money that
  // actually moved, from the same source EarningsScreen uses.
  const dash = code('screens/business/DashboardScreen.js');

  it('sums released_to_business, not gross booking totals', () => {
    expect(dash).toMatch(/released_to_business/);
    expect(dash).not.toMatch(/b\.status === 'completed' \|\| b\.status === 'confirmed'/);
  });
});
