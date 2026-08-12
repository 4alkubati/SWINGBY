/**
 * No screen or component may reference an identifier that isn't in scope.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-11 `HomeScreen.js` shipped to main calling `clientBookingRoute()`
 * with no import for it. Tapping a pinned or upcoming booking threw
 * `ReferenceError: clientBookingRoute is not defined` — a crash on the client's
 * home screen, on the most-used control on it.
 *
 * Three layers missed it, and each miss is the point:
 *
 *  1. The edit added the import conditionally, keyed on an anchor string that
 *     did not match the file. The insert silently no-op'd.
 *  2. The verification grep matched the CALL SITE and was read as success.
 *     Grepping a symbol proves it is used, never that it is defined.
 *  3. `screen-render-sweep.test.js` mounts all 47 screens but never taps one.
 *     A bad identifier inside an onPress does not execute until something
 *     presses it, so a render test cannot see it.
 *
 * Static analysis is the right shape here: catching this by interaction would
 * mean simulating every control on every screen. Babel already parses this
 * codebase (babel-jest), and its scope tracking is the same machinery ESLint's
 * `no-undef` uses — so this needs no new dependency, and no hand-rolled scope
 * parser (an earlier attempt at one produced false failures on ~60 files,
 * which is how a useful test gets deleted).
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');

const traverse = traverseModule.default || traverseModule;
const SRC = path.join(__dirname, '..');

// Real globals available at runtime in React Native / Hermes. A binding-less
// reference to one of these is correct, not a bug.
const GLOBALS = new Set([
  'require', 'module', 'exports', '__DEV__', 'globalThis', 'global', 'process',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'setImmediate', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'Headers', 'Request', 'Response', 'FormData', 'Blob', 'File',
  'AbortController', 'XMLHttpRequest', 'WebSocket', 'URL', 'URLSearchParams',
  'Promise', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Error', 'TypeError', 'RangeError', 'RegExp', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'BigInt',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Intl',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'atob', 'btoa', 'structuredClone', 'queueMicrotask', 'performance',
  'alert', 'window', 'document', 'navigator', 'location', 'localStorage',
  'undefined', 'NaN', 'Infinity', 'arguments',
]);

function sourceFiles() {
  const out = [];
  const stack = [path.join(SRC, 'screens'), path.join(SRC, 'components'), path.join(SRC, 'utils')];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== '__snapshots__') stack.push(p);
      } else if (/\.jsx?$/.test(e.name) && !e.name.includes('.test.')) {
        out.push(p);
      }
    }
  }
  return out.sort();
}

function undefinedRefs(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread'],
  });

  const missing = new Set();
  traverse(ast, {
    ReferencedIdentifier(p) {
      const { name } = p.node;
      if (GLOBALS.has(name)) return;
      // JSX intrinsics like <View> resolve as identifiers; a capitalised
      // component with no binding IS a bug, a lowercase one is host syntax.
      if (p.parent.type === 'JSXOpeningElement' && /^[a-z]/.test(name)) return;
      if (p.scope.hasBinding(name, /* noGlobals */ true)) return;
      missing.add(name);
    },
  });
  return [...missing].sort();
}

describe('every referenced identifier is in scope', () => {
  const files = sourceFiles();

  it('finds the source files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [path.relative(SRC, f), f]))('%s', (_rel, file) => {
    expect(undefinedRefs(fs.readFileSync(file, 'utf8'))).toEqual([]);
  });
});
