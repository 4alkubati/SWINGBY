// A finished job must never open the live-tracking screen.
//
// WHY THIS EXISTS
// ---------------
// Reported 2026-07-29 from the walkthrough: the cards "flip from job progress to
// a normal details posting" once a job is done. They did, and the cause was one
// line — `MyJobsScreen.handleBookingPress` sent EVERY row to `ActiveBooking`,
// Past tab included.
//
// `ActiveBooking` is specced as "Active Booking (live tracking)"
// (design/handoff-jet-pulse/README.md §2) and has no completed state. In 849
// lines it branched on status in exactly three places — the subtitle string, the
// "Live" pill, and hiding Cancel — so a job finished weeks earlier still drew a
// faux dashed "en route" route toward the client's house, a progress timeline
// pinned at its last segment, and the caption "Payment releases only when you
// approve the work" over money that had already been released (the same
// false-money-statement family as AUDIT L5/L6).
//
// It also offered no invoice, no review and no proof-of-work, while the row the
// client tapped offers all three. Tapping a card gave you LESS than the card.
// `BookingDetails` is the screen the design system specs for a static booking,
// and it already carries approve-&-release, receipt, rebook, dispute and the
// before/after photos.
//
// Two independent guards, because they fail independently: the routing decision
// in My Jobs, and the screen's own handling for a booking that completes while
// the client is sitting on it (it re-polls on focus).
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Strip comments so prose about the bug cannot satisfy a test about the fix.
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('My Jobs routes finished bookings away from live tracking', () => {
  const src = code(read('screens/client/MyJobsScreen.js'));

  it('decides the destination from the booking status', () => {
    const handler = src.match(/function handleBookingPress[\s\S]*?\n {2}}/);
    expect(handler).not.toBeNull();
    const body = handler[0];

    // Must consider both terminal states...
    expect(body).toMatch(/completed/);
    expect(body).toMatch(/cancelled/);
    // ...and be able to reach the static screen.
    expect(body).toMatch(/BookingDetails/);
  });

  it('never navigates to ActiveBooking unconditionally from the row tap', () => {
    const handler = src.match(/function handleBookingPress[\s\S]*?\n {2}}/)[0];
    // The bug shape: a bare navigate to the live screen with no status test.
    const bare = /navigate\(\s*['"]ActiveBooking['"]/.test(handler);
    if (bare) {
      // Allowed only when the same expression also picks BookingDetails.
      expect(handler).toMatch(/BookingDetails/);
    }
    expect(handler).toMatch(/status/);
  });
});

describe('an expired post survives into the Past tab', () => {
  const src = code(read('screens/client/MyJobsScreen.js'));

  // Charge-at-post bills the client's WHOLE budget the moment they post. When
  // nobody quotes, expiry_sweep.py settles the money — but this screen used to
  // drop the post on the floor: `openPosts` keeps only open/matched and the Past
  // tab listed bookings only, so a paid job vanished after seven days with
  // nothing anywhere to explain it. POST_STATUS.expired was defined and
  // unreachable, which is how we know the disappearance was never the intent.
  it('collects expired posts and puts them in Past', () => {
    expect(src).toMatch(/expiredPosts\s*=\s*posts\.filter/);
    expect(src).toMatch(/pastItems/);
  });

  it('renders posts as well as bookings in that list', () => {
    expect(src).toMatch(/kind === 'post'/);
    expect(src).toMatch(/<PostRow post=\{item\.data\}/);
  });

  it('counts them in the Past tab badge', () => {
    // A badge that disagrees with the list it labels is its own bug.
    expect(src).toMatch(/pastCount/);
    expect(src).toMatch(/Past \(\$\{pastCount\}\)/);
  });

  it('keeps a label for every post status the backend can write', () => {
    // service_posts.py: open | matched | expired | cancelled. A missing key fell
    // through to POST_STATUS.open — i.e. a cancelled post reading as
    // "Awaiting quotes".
    const map = src.match(/const POST_STATUS\s*=\s*\{[\s\S]*?\n\};/);
    expect(map).not.toBeNull();
    for (const status of ['open', 'matched', 'expired', 'cancelled']) {
      expect(map[0]).toMatch(new RegExp(`\\b${status}\\s*:`));
    }
  });

  it('does not resurface posts the client deleted', () => {
    // DELETE is a soft delete to 'cancelled'. Deleted should stay deleted, so
    // only 'expired' is revived.
    const filter = src.match(/expiredPosts\s*=\s*posts\.filter\([^)]*\)/)[0];
    expect(filter).toMatch(/expired/);
    expect(filter).not.toMatch(/cancelled/);
  });
});

describe('the live screen tells the truth about a finished booking', () => {
  const src = code(read('screens/client/ActiveBookingScreen.js'));

  it('does not promise a payment release the client can no longer make', () => {
    // The caption may exist, but not unguarded.
    const i = src.indexOf('Payment releases only when you approve the work');
    expect(i).toBeGreaterThan(-1);
    const preceding = src.slice(Math.max(0, i - 400), i);
    expect(preceding).toMatch(/completed|cancelled/);
  });

  it('only draws the travel route while there is travel', () => {
    // MapRoute is the dashed "on the way" path. It must sit behind isLive.
    const i = src.indexOf('<MapRoute');
    expect(i).toBeGreaterThan(-1);
    const preceding = src.slice(Math.max(0, i - 300), i);
    expect(preceding).toMatch(/isLive/);
  });

  it('still defines isLive as live-only statuses', () => {
    // If `completed` ever joins this list the guards above become decorative.
    const def = src.match(/const isLive\s*=[\s\S]{0,200}?;/);
    expect(def).not.toBeNull();
    expect(def[0]).not.toMatch(/completed|cancelled/);
  });
});
