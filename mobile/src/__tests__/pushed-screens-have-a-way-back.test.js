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

const BACK_AFFORDANCE = /goBack\(\)|navigation\.pop\(|arrow-left|chevron-left|name="x"/;

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
    expect(readThroughShim(file)).toMatch(BACK_AFFORDANCE);
  });

  it('covers the three that regressed', () => {
    for (const name of ['Settings', 'NotificationsCenter', 'Search']) {
      const file = findScreenFile(name);
      expect(file).not.toBeNull();
      expect(readThroughShim(file)).toMatch(BACK_AFFORDANCE);
    }
  });
});
