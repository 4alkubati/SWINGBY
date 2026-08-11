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
  // 2026-08-11: the decision used to be an inline `finished ? ... : ...` inside
  // handleBookingPress, and this block read that function's source text. It now
  // lives in utils/clientBookingRoute.js, because PRODUCT-01 needed the same
  // rule at six entry points and copying it to each is what stalled the
  // previous attempt.
  //
  // So the guard follows the logic instead of being deleted with it: My Jobs
  // must DELEGATE, and the thing it delegates to must make the right call. That
  // is strictly stronger than the old text match — the behaviour is now
  // asserted directly in utils/__tests__/clientBookingRoute.test.js rather than
  // inferred from whether the word "completed" appears in a function body.
  const src = code(read('screens/client/MyJobsScreen.js'));

  it('delegates the destination instead of hardcoding one', () => {
    const handler = src.match(/function handleBookingPress[\s\S]*?\n {2}}/);
    expect(handler).not.toBeNull();
    const body = handler[0];

    expect(body).toMatch(/clientBookingRoute\(/);
    // The bug shape this file was written for: a bare navigate to the live
    // screen with nothing deciding between the two.
    expect(body).not.toMatch(/navigate\(\s*['"]ActiveBooking['"]/);
  });

  it('imports that decision from the shared rule', () => {
    expect(src).toMatch(/import\s*\{[^}]*clientBookingRoute[^}]*\}\s*from\s*'\.\.\/\.\.\/utils\/clientBookingRoute'/);
  });

  it('and that rule considers both terminal states and can reach the static screen', () => {
    const rule = code(read('utils/clientBookingRoute.js'));
    expect(rule).toMatch(/completed/);
    expect(rule).toMatch(/cancelled/);
    expect(rule).toMatch(/BookingDetails/);
    // It must branch on status, not send everything one way.
    expect(rule).toMatch(/status/);
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

describe('the cancellation ladder is actually reachable', () => {
  // `confirm-date` sets confirmed_date AND status:'in_progress' in one update
  // (backend/app/api/bookings.py), so a booking is only 'confirmed' while it has
  // no agreed date. Gating Cancel on 'confirmed' alone therefore exposed exactly
  // one outcome of the published ToS ladder — 'no_date', the free one. Client
  // cancels at >48h / <=48h / after the date, and every business-side penalty,
  // were unreachable no matter what the Terms promised.
  //
  // 'on_the_way' is NOT a bookings.status (it is a booking_events.event_type),
  // so listing it matched nothing and hid the bug behind a plausible-looking
  // array of two.
  const files = [
    'screens/client/BookingDetailsScreen.js',
    'screens/client/ActiveBookingScreen.js',
  ];

  for (const f of files) {
    describe(f.split('/').pop(), () => {
      const src = code(read(f));

      it('offers cancel on in_progress, not just confirmed', () => {
        const gates = src.match(/\['confirmed',\s*'[a-z_]+'\]/g) || [];
        expect(gates.length).toBeGreaterThan(0);
        for (const g of gates) expect(g).toMatch(/in_progress/);
      });

      it('does not gate anything on the non-existent on_the_way status', () => {
        // Guarding a status the backend never writes is a silent no-op.
        expect(src).not.toMatch(/\[\s*'confirmed',\s*'on_the_way'\s*\]/);
      });
    });
  }
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

  it('only draws the travel route between two real points', () => {
    // Was: MapRoute had to sit behind `isLive`. It now sits behind `prov && dest`,
    // which is strictly stronger — `prov` is only built when the booking is live
    // AND a real fix exists, so a finished job cannot draw travel, and neither
    // can a live one with no location to show.
    const i = src.indexOf('<MapRoute');
    expect(i).toBeGreaterThan(-1);
    const preceding = src.slice(Math.max(0, i - 300), i);
    expect(preceding).toMatch(/prov && dest/);
  });

  it('plots real coordinates rather than hardcoded pixels', () => {
    // The hero used to draw a five-point dashed route through invented pixel
    // coordinates — on the Huawei (no Play Services, canvas is the only map that
    // can render) that WAS the live-tracking experience.
    expect(src).toMatch(/projectToBox/);
    expect(src).not.toMatch(/\{ x: 40, y: 200 \}/);
  });

  it('still defines isLive as live-only statuses', () => {
    // If `completed` ever joins this list the guards above become decorative.
    const def = src.match(/const isLive\s*=[\s\S]{0,200}?;/);
    expect(def).not.toBeNull();
    expect(def[0]).not.toMatch(/completed|cancelled/);
  });
});
