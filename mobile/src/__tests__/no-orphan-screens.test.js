// Every registered screen must be reachable.
//
// WHY THIS EXISTS
// ---------------
// On 2026-07-26 the walkthrough found voice memos and live location both
// "missing" from the running app. Neither was broken. Both were built, both had
// passing unit tests, and both had been merged to main and deployed:
//
//   * ProofOfWorkScreen was registered in BusinessNavigator and NOTHING called
//     navigate('ProofOfWork') — the recorder had no door.
//   * ApproveWorkScreen (client review & release, the screen that moves the
//     held payment) was registered in ClientNavigator with no route to it.
//   * LiveLocationSharing was imported by its own test file and by nothing
//     else, so the provider never broadcast and the client's map correctly
//     rendered nothing.
//
// Component tests could not catch any of this: they render the component
// directly, which is precisely the step the app was failing to do. This test
// asserts the thing those tests assume — that a user can actually get there.
//
// The same check exists in tools/flow_graph.py, but that is a manual command.
// This runs on every mobile CI job.
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
const NAV_DIR = path.join(SRC, 'navigation');

// Screens that legitimately have no navigate() call pointing at them.
// Anything added here needs a reason, because the default answer is "wire it".
const REACHABLE_WITHOUT_NAVIGATE = new Set([
  // Tab bars render these; the user reaches them by tapping a tab.
  'Home', 'My Jobs', 'Messages', 'Profile', 'Dashboard', 'Jobs',
  // Stack roots — the first screen of their navigator.
  // 'AdminHome' is AdminNavigator's root: an admin lands on it at sign-in, and
  // from there navigates to RefundQueue -> RefundReview (both of which this test
  // does check have routes into them).
  'ClientTabs', 'BusinessTabs', 'AuthTabs', 'AdminHome',
  // First screen of AuthNavigator; a logged-out user lands here.
  'Onboarding',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(p, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

/** Screen names registered on any navigator. */
function registeredScreens() {
  const found = new Map(); // name -> navigator file
  for (const file of fs.readdirSync(NAV_DIR).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(NAV_DIR, file), 'utf8');
    for (const m of src.matchAll(/<(?:Stack|Tab|Drawer)\.Screen\s+name=["']([^"']+)["']/g)) {
      if (!found.has(m[1])) found.set(m[1], file);
    }
  }
  return found;
}

/** Screen names that something, somewhere, navigates to. */
function navigatedNames() {
  const names = new Set();
  // navigate('X'), push('X'), replace('X'), navigate('X', {...}), and the
  // nested form navigate('Parent', { screen: 'Child' }).
  const patterns = [
    /\.(?:navigate|push|replace)\(\s*["']([^"']+)["']/g,
    /screen:\s*["']([^"']+)["']/g,
    // navigation.reset({ routes: [{ name: 'X' }] }) — the stack-clearing form.
    // Missing this made the test wrongly call RequestSent an orphan, and the
    // wrong exemption then documented a flow as "not built" when PostJobScreen
    // had been reaching it via reset() all along. A screen reached ONLY by
    // reset() is still reachable.
    /name:\s*["']([^"']+)["']/g,
  ];
  for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of src.matchAll(re)) names.add(m[1]);
    }
  }
  return names;
}

describe('navigation wiring', () => {
  it('every registered screen has at least one route into it', () => {
    const registered = registeredScreens();
    const reached = navigatedNames();

    expect(registered.size).toBeGreaterThan(10); // the scraper still works

    const orphans = [...registered.entries()]
      .filter(([name]) => !REACHABLE_WITHOUT_NAVIGATE.has(name) && !reached.has(name))
      .map(([name, nav]) => `${name} (registered in ${nav})`);

    expect(orphans).toEqual([]);
  });

  it('the provider half of live location is mounted, not just written', () => {
    // ProviderLiveLocation (what the CLIENT sees) is useless unless the
    // PROVIDER is broadcasting. This asserts the broadcaster is on a screen.
    const mounts = walk(path.join(SRC, 'screens')).filter((f) =>
      /<LiveLocationSharing[\s/>]/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(mounts.length).toBeGreaterThan(0);
  });
});
