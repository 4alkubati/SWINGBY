// Both business controls that finish a job go through ONE implementation.
//
// Walkthrough item 2. The failure was not that either screen was wrong on its
// own — it was that there were two of them, in different places, each doing
// half the job, and the half that gets skipped decides whether the business is
// paid. So what is worth pinning here is that neither screen can drift back
// into doing its own half:
//
//   ProofOfWorkScreen  — used to POST /proof/submit and stop
//   JobManagementScreen — used to PATCH /complete and stop
//
// Source assertions, in the style of finished-jobs-avoid-live-screen.test.js:
// the behaviour of the shared module is covered directly in
// services/__tests__/finishJob.test.js, and what remains to check is which
// module each screen calls.
import fs from 'fs';
import path from 'path';
import i18n from '../i18n';

const SRC = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Strip comments so prose about the bug cannot satisfy a test about the fix —
// both files explain the old behaviour at length.
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const proof = code(read('screens/business/ProofOfWorkScreen.js'));
const jobs = code(read('screens/business/JobManagementScreen.js'));

describe('the proof screen finishes the job, not just the paperwork', () => {
  it('calls finishJob instead of submitting proof by hand', () => {
    expect(proof).toMatch(/from '\.\.\/\.\.\/services\/finishJob'/);
    expect(proof).toMatch(/finishJob\(bookingId/);
    // The bare submit is what left the money frozen.
    expect(proof).not.toMatch(/api\.post\(`\/bookings\/\$\{bookingId\}\/proof\/submit`\)/);
  });

  it('no longer blocks the CTA on the photo minimum', () => {
    // It used to be `disabled={!canSubmit || alreadySubmitted}` — the only
    // control that finishes a job, refusing with no reason on screen until
    // four photos existed.
    expect(proof).not.toMatch(/disabled=\{!canSubmit/);
    expect(proof).toMatch(/disabled=\{submitting \|\| alreadyDone\}/);
  });

  it('says what is missing instead of just being dead', () => {
    expect(proof).toMatch(/finish\.photoHint/);
  });
});

describe('the stage tracker finishes the job the same way', () => {
  it('routes completion through finishJob', () => {
    expect(jobs).toMatch(/from '\.\.\/\.\.\/services\/finishJob'/);
    expect(jobs).toMatch(/finishJob\(bookingId\)/);
    // Completing without sending the photos already loaded on the other screen
    // is how a client approved against no evidence.
    expect(jobs).not.toMatch(/api\.patch\(`\/bookings\/\$\{bookingId\}\/complete`\)/);
  });

  it('tells the business the photos went, when they did', () => {
    expect(jobs).toMatch(/approval\.businessWaitingBodyProof/);
    expect(jobs).toMatch(/FINISH_DONE/);
  });
});

describe('the frozen-money state gets its own words on both screens', () => {
  it.each([
    ['ProofOfWorkScreen', proof],
    ['JobManagementScreen', jobs],
  ])('%s never hides it behind generic error copy', (_name, src) => {
    expect(src).toMatch(/proofSentButNotComplete/);
    expect(src).toMatch(/finish\.halfDoneTitle/);
  });
});

describe('the copy exists in every language we offer', () => {
  const KEYS = [
    'finish.cta',
    'finish.ctaDone',
    'finish.ctaA11y',
    'finish.confirmTitle',
    'finish.confirmWithProof',
    'finish.confirmNoProof',
    'finish.confirmCta',
    'finish.doneToastTitle',
    'finish.doneToastBodyProof',
    'finish.doneToastBodyNoProof',
    'finish.photoHint',
    'finish.halfDoneTitle',
    'finish.failedTitle',
    'finish.failedBody',
    'approval.businessWaitingBodyProof',
  ];

  it.each(['en', 'fr-CA', 'ar', 'uk'])('%s', (locale) => {
    const missing = KEYS.filter((k) => !i18n.translations[locale][k]);
    expect({ locale, missing }).toEqual({ locale, missing: [] });
  });

  it('every locale states the 24 hours, since that is when the money moves', () => {
    for (const locale of ['en', 'fr-CA', 'ar', 'uk']) {
      expect(i18n.translations[locale]['finish.confirmWithProof']).toMatch(/24/);
      expect(i18n.translations[locale]['finish.confirmNoProof']).toMatch(/24/);
    }
  });
});
