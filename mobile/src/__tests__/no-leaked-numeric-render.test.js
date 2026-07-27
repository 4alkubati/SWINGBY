// `{someNumber && <JSX/>}` is a red box waiting to happen.
//
// WHY THIS EXISTS
// ---------------
// 2026-07-26, on a real device: "Console Error: Text strings must be rendered
// within a <Text> component." The stack was entirely React internals
// (createTextInstance -> completeWork) and named no file in this repo, so it
// cost a walkthrough to find by hand.
//
// The cause: `{booking.total_amount && <DetailRow/>}`. When total_amount is the
// NUMBER 0, `0 && x` evaluates to `0` — not `false` — and React Native renders
// a loose `0` as a text node. Outside <Text>, that throws. A booking that has
// not been priced yet has total_amount 0, so this fired on ordinary data.
//
// Three instances existed at once (ActiveBookingScreen, JobManagementScreen,
// BusinessProfileScreen) while DashboardScreen had already learned the lesson
// and guarded the very same field with `Number(b.total_amount) || 0`. That is
// the signature of a bug the codebase keeps re-learning, which is what a test
// is for.
//
// Strings have the same trap (`'' && <X/>` renders nothing, but `'0'` and other
// odd values do not), so the safe form is an explicit comparison:
//     {Number(x) > 0 && <JSX/>}      {x != null && <JSX/>}      {!!x && <JSX/>}
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

// Field names whose values come from the API as numbers. A bare `&&` on any of
// these can leak a 0 into the tree.
const NUMERIC_FIELD = /(amount|price|total|count|_km|_m\b|rating|quantity|qty|radius|distance|duration|seconds|minutes|budget|fee|cut|balance|credits?)$/i;

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

describe('JSX numeric guards', () => {
  it('never guards JSX with a bare && on a numeric field', () => {
    // `{ foo.bar_amount && (` or `{ foo?.count && <`
    const risky = /\{\s*([A-Za-z_$][\w$?.]*?)\s*&&\s*[(<]/g;
    const offenders = [];

    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split('\n');
      for (const m of src.matchAll(risky)) {
        const expr = m[1];
        const leaf = expr.split(/[.?]/).filter(Boolean).pop() || '';
        if (!NUMERIC_FIELD.test(leaf)) continue;
        // `.length` is the one numeric leaf that is idiomatic and safe *only*
        // when the author meant it; it still leaks 0, so it is NOT exempt.
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(
          `${path.relative(SRC, file)}:${line}  {${expr} && ...}  ` +
            `-> use Number(${expr}) > 0`,
        );
        void lines;
      }
    }

    expect(offenders).toEqual([]);
  });
});
