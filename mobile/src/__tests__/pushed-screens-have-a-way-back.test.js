/**
 * D20 — every pushed screen must draw its own way back.
 *
 * Every navigator in this app sets `headerShown: false`, so there is no native
 * header and therefore no default back button anywhere. That is a deliberate
 * design choice, but it means the back affordance is each screen's own
 * responsibility and NOTHING enforced it. Three screens drew none — Settings,
 * NotificationsCenter and Search. On Android the hardware button still works;
 * on iOS the only exit was the edge-swipe gesture, which a non-technical user
 * does not know exists.
 *
 * This test is the enforcement. It reads the navigators, finds every screen
 * pushed onto a stack, and asserts each one's source contains a back
 * affordance. Add a pushed screen without one and this fails.
 *
 * Deliberately source-text based: mounting all 47 screens to look for a button
 * is far slower and much more fragile than reading what they render.
 *
 * Tightened 2026-08-11 (design/SPEC-screen-header.md migration): the old
 * BACK_AFFORDANCE regex matched `goBack()`/`arrow-left`/`chevron-left`/`x`
 * ANYWHERE in a screen's source, which the spec's own audit caught passing on
 * pure accident — `chevron-left` on ApproveWorkScreen's photo-comparator swipe
 * hint, `x` on three unrelated "remove photo" buttons, and even the literal
 * substring `goBack()` inside PostJobScreen's locally-defined wizard-step
 * `function goBack()`, which never calls `navigation.goBack()` on its first
 * step at all. None of those prove a real back control exists.
 *
 * Now that every mechanical screen renders the shared `ScreenHeader`
 * component, most screens are checked by asserting that import instead of
 * pattern-matching icon names — a screen either imports it or it doesn't.
 * The screens NOT on ScreenHeader are a short, named list, each with a
 * documented reason (see design/SPEC-screen-header.md's migration report):
 * those keep the old loose regex, which is still meaningful for a genuinely
 * hand-rolled header, just not proof by itself for everyone else anymore.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const NAV_DIR = path.join(SRC, 'navigation');

// Roots of a stack, or of a tab, are not "pushed" — there is nothing to go
// back to, and the app's own flows treat them as terminal entry points.
const NOT_PUSHED = new Set([
  'Login', 'Signup', 'Onboarding', 'ForgotPassword', 'ResetPassword',
  'Home', 'Dashboard', 'Tabs', 'Main', 'Splash', 'RoleSelect',
  // Reached via navigation.reset(), so there is no back stack by design, and
  // its gesture is disabled on purpose so you cannot swipe into a submitted
  // form. It carries its own forward CTA instead.
  'RequestSent',
]);

// Named, documented exceptions that do NOT render <ScreenHeader> — each one
// keeps its own hand-rolled back control instead, for a specific reason:
//   - NearbyMap: the one permanent floating-circle-over-map exception (spec §2).
//   - ActiveBooking: same shape as NearbyMap — a translucent circle floating
//     over the live map/canvas hero, not a top bar (HeroChrome).
//   - Search: D20's own comment says the back arrow sits ABOVE the search
//     field with no title at all, on purpose, so autoFocus's keyboard never
//     competes with a title. ScreenHeader requires a non-empty title (spec §4).
//   - Chat / MessageThread (shim to Chat): the header's middle "title" area is
//     an interactive open-business-profile button with a live subtitle, not
//     static text — ScreenHeader's title is plain, non-interactive Text.
//   - BusinessProfile: a conditional 3-4-widget trailing area (Edit/Cancel
//     text buttons, a favorite heart, an animated sticky title-on-scroll)
//     that doesn't fit ScreenHeader's single icon-only trailing slot.
//   - JobManagement: its JobDetailScreen branch's trailing content is a
//     StatusChip pill, not a Feather icon.
const NOT_ON_SCREEN_HEADER = new Set([
  'NearbyMap', 'ActiveBooking', 'Search', 'Chat', 'MessageThread',
  'BusinessProfile', 'JobManagement',
]);

const BACK_AFFORDANCE = /goBack\(\)|navigation\.pop\(|arrow-left|chevron-left|name="x"/;
const SCREEN_HEADER_IMPORT = /from\s+['"][^'"]*\/components\/ScreenHeader['"]/;

function screenNames() {
  const names = new Set();
  for (const f of fs.readdirSync(NAV_DIR).filter((n) => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(NAV_DIR, f), 'utf8');
    for (const m of src.matchAll(/<Stack\.Screen\s+name="([A-Za-z0-9_]+)"/g)) {
      names.add(m[1]);
    }
  }
  return [...names];
}

function findScreenFile(name) {
  const stack = [path.join(SRC, 'screens')];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') stack.push(p);
      } else if (entry.name === `${name}Screen.js`) {
        return p; // native file only — never the .web.js variant
      }
    }
  }
  return null;
}

// Some routes are registered but are pure re-export shims onto the screen that
// really renders — MessageThread was consolidated into ChatScreen in 2026-07,
// keeping its route and deep link alive. Those files have no UI of their own,
// so the affordance to check is the target's. Follow the re-export instead of
// excluding the name, so a shim can never be used to smuggle a screen past
// this guard.
function readThroughShim(file, depth = 0) {
  const src = fs.readFileSync(file, 'utf8');
  const reExport = src.match(/export\s*\{\s*default\s*\}\s*from\s*'(\.[^']+)'/);
  if (reExport && depth < 3) {
    const target = path.join(path.dirname(file), `${reExport[1]}.js`);
    if (fs.existsSync(target)) return readThroughShim(target, depth + 1);
  }
  return src;
}

describe('pushed screens have a visible way back', () => {
  const pushed = screenNames().filter((n) => !NOT_PUSHED.has(n));

  it('finds the pushed screens to check', () => {
    expect(pushed.length).toBeGreaterThan(20);
  });

  it.each(pushed)('%s draws a back affordance', (name) => {
    const file = findScreenFile(name);
    if (!file) return; // screen defined inline in a navigator — nothing to read
    const src = readThroughShim(file);
    if (NOT_ON_SCREEN_HEADER.has(name)) {
      expect(src).toMatch(BACK_AFFORDANCE);
    } else {
      expect(src).toMatch(SCREEN_HEADER_IMPORT);
    }
  });

  it('covers the three that regressed', () => {
    // Settings and NotificationsCenter are migrated onto ScreenHeader; Search
    // deliberately keeps its own bare arrow (no title at all, see
    // NOT_ON_SCREEN_HEADER above) so it stays on the old regex.
    for (const name of ['Settings', 'NotificationsCenter']) {
      const file = findScreenFile(name);
      expect(file).not.toBeNull();
      expect(readThroughShim(file)).toMatch(SCREEN_HEADER_IMPORT);
    }
    const searchFile = findScreenFile('Search');
    expect(searchFile).not.toBeNull();
    expect(readThroughShim(searchFile)).toMatch(BACK_AFFORDANCE);
  });

  it('every NOT_ON_SCREEN_HEADER name is still a real, currently-pushed screen', () => {
    // Guards the exception list itself from going stale — if a name is
    // migrated later or removed from the navigators, this catches the drift
    // instead of the exception silently doing nothing.
    for (const name of NOT_ON_SCREEN_HEADER) {
      expect(pushed).toContain(name);
    }
  });
});
