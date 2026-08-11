// B-01 — Terms of Service section 2 said payment "is automatically released
// to the service provider upon job completion" and implied photo proof was
// required to mark a job done. Both are false: backend/app/services/
// approvals.py opens a 24-hour window on completion — the client approving
// releases the money, or the window closing auto-releases it — and proof is
// optional (MIN_BEFORE/MIN_AFTER in proof_of_work.py only gate whether proof
// CAN be sent, not whether the job can be marked done).
//
// Fixing the text, not the code — the code is the ruling (CLAUDE.md).
// The cancellation-ladder paragraph in the same section is separately
// required to match escrow.py verbatim and must be untouched by this fix.
import fs from 'fs';
import path from 'path';

const SCREEN = path.join(__dirname, '..', 'screens', 'shared', 'TermsOfServiceScreen.js');
const src = fs.readFileSync(SCREEN, 'utf8');

describe('Terms of Service — payment release copy matches approvals.py', () => {
  it('no longer claims release happens automatically on completion alone', () => {
    expect(src).not.toMatch(/automatically released to the service provider upon job completion/);
  });

  it('states the real 24-hour approval window', () => {
    expect(src).toMatch(/24 hours? to review and approve/);
    expect(src).toMatch(/releases automatically once the 24-hour window closes/);
  });

  it('does not claim photo proof is required to mark a job done', () => {
    expect(src).toMatch(/not required to mark a job done/);
  });

  it('keeps the 48h/75%/25%/50% cancellation ladder verbatim (must match escrow.py)', () => {
    expect(src).toMatch(
      /more than 48 hours before, you are refunded in full; within 48 hours, 75% is refunded and 25% goes to the business; if the confirmed time has already passed, 50% is refunded\. If no date has been confirmed yet, you are refunded in full\./
    );
  });
});
