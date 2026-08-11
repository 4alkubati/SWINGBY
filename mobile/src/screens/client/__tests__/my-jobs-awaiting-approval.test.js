// The other half of walkthrough bug 1. Kira's words: "money with a deadline,
// filed under Past, badged DONE, with no prompt on Home."
//
// Home now carries the prompt (home-approval-prompt.test.js). This pins the row
// the client lands on afterwards, so it cannot contradict that prompt: while
// the payment is still held the badge must not say the job is Done-in-green,
// and releasing it must be on the row rather than behind BookingDetails' ⋯,
// which is the control the walkthrough found invisible to an older user.
//
// Source assertions, following finished-jobs-avoid-live-screen.test.js: this
// screen's rows need a FlatList, four data fetches and a role context to reach
// on a render, and what is being pinned here is the decision, not the pixels.
import fs from 'fs';
import path from 'path';
import i18n from '../../../i18n';

const SRC = path.join(__dirname, '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// Strip comments so prose about the bug cannot satisfy a test about the fix.
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const src = code(read('screens/client/MyJobsScreen.js'));

describe('a Past row waiting on the client does not claim to be finished', () => {
  it('reads the shared predicate rather than re-deciding locally', () => {
    expect(src).toMatch(/import \{[^}]*isAwaitingApproval[^}]*\} from '\.\.\/\.\.\/utils\/approval'/);
    expect(src).toMatch(/isAwaitingApproval\(booking\)/);
  });

  it('badges it "Needs your OK", not green "Done"', () => {
    // The green Done pill is still there for a job that really is finished and
    // paid — this only overrides it while the money is held.
    expect(src).toMatch(/approvalCard\.badge/);
    expect(src).toMatch(/tone: 'warning'/);
    expect(src).toMatch(/completed:\s*\{\s*label: 'Done',\s*tone: 'success' \}/);
  });

  it('only applies to the client — the business is not who approves', () => {
    expect(src).toMatch(/userRole === 'client' && isAwaitingApproval\(booking\)/);
  });
});

describe('releasing the payment is on the row, not behind an overflow', () => {
  // F139: this used to navigate('ApproveWork', ...) unconditionally — the
  // before/after photo review screen. Most jobs never get photos
  // (bookings.py::approve_completed_work), and that screen's own "no proof
  // yet" state has no release control at all, so a photo-less job left the
  // client with a badge and no working action. The row now does the same
  // direct POST /bookings/{id}/approve release Home's ApprovalPromptCard and
  // BookingDetailsScreen already use, which works with or without photos.
  it('offers Review & approve as a direct release, not a dead end into the photo screen', () => {
    expect(src).toMatch(/approvalCard\.reviewAction/);
    expect(src).toMatch(/onApprove=\{isClient \? \(\) => handleApprove\(booking\) : undefined\}/);
    expect(src).toMatch(/api\.post\(`\/bookings\/\$\{booking\.id\}\/approve`\)/);
  });

  it('gives that action the row\'s single highlight', () => {
    // Rebook drops its highlight while an approval is outstanding: two
    // highlighted buttons on one row is no highlight at all.
    expect(src).toMatch(/highlight=\{!awaiting\}/);
  });
});

describe('the badge copy exists in every language we offer', () => {
  it.each(['en', 'fr-CA', 'ar', 'uk'])('%s', (locale) => {
    const cat = i18n.translations[locale];
    expect(cat['approvalCard.badge']).toBeTruthy();
    expect(cat['approvalCard.reviewAction']).toBeTruthy();
  });
});
