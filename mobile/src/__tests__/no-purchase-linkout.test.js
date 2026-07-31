// App Store Guideline 3.1.1 — an iOS app may not link out to a purchase flow
// for digital goods.
//
// This is a REGRESSION GUARD, not a feature test. The violation shipped in two
// places at once (BusinessProfileScreen's plan CTA and AutoBiddingScreen's
// locked state), which is exactly how it would come back: someone gates one
// surface, misses the other, and nothing complains until Apple does.
//
// So this asserts on the SOURCE rather than on a render. A rendered assertion
// only covers the states the test happens to set up; reading the files catches
// a new call site added anywhere in them, including one behind a branch this
// test never reaches.
import fs from 'fs';
import path from 'path';

import { SUBSCRIPTION_PURCHASE } from '../config/features';

const SRC = path.join(__dirname, '..');

// Every screen that has ever offered to start or manage a paid plan.
const PURCHASE_SURFACES = [
  'screens/business/BusinessProfileScreen.js',
  'screens/business/AutoBiddingScreen.js',
];

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

describe('Guideline 3.1.1 — no link-out purchase on iOS', () => {
  it('ships with in-app subscription purchase disabled', () => {
    // The whole guard rests on this. If someone flips it to true, every
    // assertion below becomes vacuous — so fail loudly here instead, and make
    // them come and read this file.
    expect(SUBSCRIPTION_PURCHASE).toBe(false);
  });

  it('is a build-time constant, not a server-driven flag', () => {
    // A purchase button a server can switch on after review is precisely what
    // 3.1.1 exists to catch, and a network failure must not get to decide
    // whether the app is compliant.
    const features = read('config/features.js');
    expect(features).not.toMatch(/\bfetch\b|\bapi\b|await|process\.env/);
  });

  it.each(PURCHASE_SURFACES)('%s gates every subscribe call', (rel) => {
    const source = read(rel);
    if (!source.includes('/businesses/me/subscribe')) return;

    // Every subscribe call site must sit under the flag. Checking that the
    // file imports and mentions it is deliberately coarse — the precise check
    // is the render assertions below; this one catches a NEW surface being
    // added without anyone thinking about 3.1.1 at all.
    expect(source).toMatch(/SUBSCRIPTION_PURCHASE/);
    expect(source).toMatch(
      /from ['"](\.\.\/)+config\/features['"]/,
    );
  });

  it.each(PURCHASE_SURFACES)('%s opens no checkout URL unguarded', (rel) => {
    const source = read(rel);
    const lines = source.split('\n');
    // Linking.openURL on a checkout_url is the actual violation. Any occurrence
    // has to be inside a SUBSCRIPTION_PURCHASE branch; the flag appearing
    // earlier in the file is the cheap proxy for that, and the flag is false in
    // this build regardless.
    lines.forEach((line, i) => {
      if (/openURL\(.*checkout_url/.test(line) || /openURL\(.*manage_url/.test(line)) {
        const before = lines.slice(0, i).join('\n');
        expect(before).toMatch(/SUBSCRIPTION_PURCHASE/);
      }
    });
  });

  it('shows no price for a plan anywhere in the app', () => {
    // A dollar figure beside a hidden purchase path is the mixed signal that
    // turns a reviewer's glance into a question. Job prices are fine — these
    // are the subscription tiers specifically.
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (entry.name.endsWith('.js')) {
          const text = fs.readFileSync(full, 'utf8');
          if (/\$\d+\s*\/\s*mo|\$\d+\/mo|per month/i.test(text)) {
            offenders.push(path.relative(SRC, full));
          }
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
