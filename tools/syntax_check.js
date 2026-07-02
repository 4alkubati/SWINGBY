// Fast syntax-only pass over mobile/src/**/*.js using @babel/parser.
// Catches JSX / ES2020+ syntax errors without a full Metro bundle.
//
// Run: node tools/syntax_check.js
//
// Exits 0 if all files parse, 1 otherwise. Prints one line per bad file.

const fs = require('fs');
const path = require('path');
const parser = require(path.join(__dirname, '..', 'mobile', 'node_modules', '@babel', 'parser'));

const ROOT = path.join(__dirname, '..', 'mobile', 'src');
const errors = [];
let scanned = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    scanned++;
    const code = fs.readFileSync(full, 'utf8');
    try {
      parser.parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        errorRecovery: false,
        plugins: [
          'jsx',
          'classProperties',
          'optionalChaining',
          'nullishCoalescingOperator',
          'objectRestSpread',
          'dynamicImport',
          'topLevelAwait',
        ],
      });
    } catch (e) {
      const rel = path.relative(ROOT, full);
      errors.push(`${rel}:${e.loc ? e.loc.line : '?'} ${e.message}`);
    }
  }
}

walk(ROOT);

console.log(`[syntax_check] scanned ${scanned} files`);
if (errors.length === 0) {
  console.log('[syntax_check] OK — every file parses');
  process.exit(0);
}
console.log(`[syntax_check] ${errors.length} file(s) failed:`);
for (const e of errors) console.log('  ' + e);
process.exit(1);
