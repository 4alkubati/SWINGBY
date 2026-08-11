// F121 — "Plans are managed on swingbyy.com" pointed business owners at a
// URL that cannot fulfil the promise: swingbyy.com is currently served by
// web/pre-launch (VITE_PRELAUNCH_GATE=true), which only routes /, /privacy,
// /terms, /cookies, /contact — no subscription page exists there, and
// web/launch (which has the real billing routes) is, per docs/DEPLOY.md,
// "built and CI-green, never deployed."
//
// Source-inspection test (like no-purchase-linkout.test.js): the two
// SUBSCRIPTION_PURCHASE-off fallback branches must no longer name
// swingbyy.com, and must offer a contact action this app can actually
// fulfil (a mailto, not a link to a page that doesn't exist).
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

const SURFACES = [
  'screens/business/BusinessProfileScreen.js',
  'screens/business/AutoBiddingScreen.js',
];

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

describe('F121 — no dead swingbyy.com promise on the plan-managed copy', () => {
  it.each(SURFACES)('%s never claims plans are managed on swingbyy.com', (rel) => {
    const source = read(rel);
    expect(source).not.toMatch(/managed on\s*\n?\s*swingbyy\.com/);
  });

  it.each(SURFACES)('%s offers a real support contact instead', (rel) => {
    const source = read(rel);
    expect(source).toMatch(/mailto:support@swingbyy\.com/);
  });
});
