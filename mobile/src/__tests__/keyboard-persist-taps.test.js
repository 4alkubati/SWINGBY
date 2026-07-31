// Buttons that are visible, enabled, and dead to the first tap — 2026-07-30.
//
// Found in the walkthrough as "after editing a profile I can't click Done, it
// shows Done but it's not clickable". Nothing was wrong with the button: the
// business profile's edit fields and its Save button live in the SAME
// ScrollView, and a React Native ScrollView defaults to
//
//     keyboardShouldPersistTaps="never"
//
// which means the first tap anywhere outside the focused TextInput is consumed
// dismissing the keyboard and delivered to no one. You type, you tap Save,
// nothing happens, you tap again and it works. Every static check passes —
// the handler is wired, the route exists, `disabled` is false — so this class
// is invisible to route sweeps and to `onPress`-is-empty greps. It only shows
// up with a keyboard on screen, which is why a human found it and the audit
// did not.
//
// The same defect was live on ChatScreen, where the list header holds the
// quote card: accepting a quote while the composer had focus did nothing.
//
// This is a SOURCE scan on purpose. Rendering each screen and driving a
// keyboard would need a device; the property we actually care about is
// syntactic and cheap to keep true.
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// A scroll container that can hold both an input and a control. Horizontal
// strips are excluded by the caller — a horizontal photo rail is not where a
// submit button lives, and forcing the prop there is noise.
const SCROLLER = /<(ScrollView|FlatList|SectionList|Animated\.ScrollView|AnimatedScrollView|AnimatedFlatList)\b/;

/**
 * The props of a JSX opening tag, given the source starting at its `<`.
 *
 * Not `chunk.split('>')[0]` — props are full of `>`: `keyExtractor={(m) => …}`
 * and `renderItem={({ item }) => …}` both close the tag early and truncate the
 * scan to nothing, which made this test fail on the very files it had just
 * been written to protect. Track brace depth and stop at the `>` that is
 * actually at tag level.
 */
function openingTag(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return src.slice(start, i);
  }
  return src.slice(start);
}

/** Every vertical scroll container in a file, as its opening-tag props. */
function verticalScrollers(src) {
  const re = /<((?:Animated\.)?(?:ScrollView|FlatList|SectionList|AnimatedScrollView|AnimatedFlatList))\b/g;
  const found = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const props = openingTag(src, m.index);
    // A horizontal rail cannot contain the submit button; requiring the prop
    // there would be noise rather than safety.
    if (/\bhorizontal\b(?!\s*=\s*\{false\})/.test(props)) continue;
    found.push({ tag: m[1], props });
  }
  return found;
}

describe('a keyboard never eats the first tap on a control', () => {
  const files = walk(SRC).filter((f) => {
    const src = fs.readFileSync(f, 'utf8');
    return SCROLLER.test(src) && /<TextInput\b/.test(src);
  });

  it('finds the screens this rule has to hold for', () => {
    // Guards the guard: if this drops to zero the scan silently stops testing
    // anything, which is the usual way a source-scanning test rots.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [path.relative(SRC, f), f]))(
    '%s sets keyboardShouldPersistTaps on its scroll container',
    (_rel, file) => {
      const src = fs.readFileSync(file, 'utf8');

      for (const { tag, props } of verticalScrollers(src)) {
        // Named in the failure so the message says WHICH container, not just
        // which file — several of these screens have more than one.
        expect(`${tag}: ${props}`).toMatch(/keyboardShouldPersistTaps/);
      }
    },
  );
});

describe('the value is "handled", not "always"', () => {
  // "always" also keeps the keyboard OPEN on a background tap, so tapping
  // blank space to dismiss it stops working — trading one dead-feeling screen
  // for another. "handled" delivers the tap to a control that will handle it
  // and still dismisses on everything else.
  const offenders = walk(SRC).filter((f) =>
    /keyboardShouldPersistTaps\s*=\s*["']always["']/.test(fs.readFileSync(f, 'utf8')),
  );

  it('no screen uses "always"', () => {
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
