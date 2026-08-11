// F102 — DisputeFlowScreen's issue-type picker offered keys the backend
// never accepted ('not_completed', 'quality'), so 2 of 4 options always
// 400'd against VALID_ISSUE_TYPES in backend/app/api/disputes.py. 'quality'
// -> 'poor_quality' is a clean rename onto an existing backend type.
//
// 'not_completed' has NO backend equivalent and is deliberately left as-is —
// that one needs a product decision (map it to an existing type, or add it
// to VALID_ISSUE_TYPES), not a guess. This test only pins what WAS fixed.
//
// Static source assertions: ISSUE_TYPES isn't exported and a full render
// needs navigation/api mocking this rename doesn't need.

import fs from 'fs';
import path from 'path';

const SCREEN = path.join(__dirname, '..', 'screens', 'flows', 'DisputeFlowScreen.js');
const BACKEND = path.join(__dirname, '..', '..', '..', 'backend', 'app', 'api', 'disputes.py');

const src = fs.readFileSync(SCREEN, 'utf8');
const issueTypesBlock = src.match(/const ISSUE_TYPES = \[[\s\S]*?\];/)[0];

function extractKeys(block) {
  return [...block.matchAll(/key:\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("DisputeFlowScreen's issue-type keys", () => {
  it('renamed the dead "quality" key to the backend\'s "poor_quality"', () => {
    expect(issueTypesBlock).not.toMatch(/key:\s*'quality'/);
    expect(issueTypesBlock).toMatch(/key:\s*'poor_quality'/);
  });

  it('every renamed/existing key that has a backend equivalent is in VALID_ISSUE_TYPES', () => {
    const backendSrc = fs.readFileSync(BACKEND, 'utf8');
    const validBlock = backendSrc.match(/VALID_ISSUE_TYPES = \{[\s\S]*?\}/)[0];
    const validTypes = [...validBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

    const keys = extractKeys(issueTypesBlock);
    // 'not_completed' is the one known gap — deliberately excluded here,
    // it is not silently mapped to anything.
    const withBackendEquivalent = keys.filter((k) => k !== 'not_completed');
    for (const key of withBackendEquivalent) {
      expect(validTypes).toContain(key);
    }
  });

  it('still flags not_completed as the one unmapped key (no guessed mapping)', () => {
    // Documents intent: if this ever starts failing because 'not_completed'
    // got mapped, that mapping must have come from a product decision, not
    // a silent guess in a future diff.
    expect(extractKeys(issueTypesBlock)).toContain('not_completed');
  });
});
