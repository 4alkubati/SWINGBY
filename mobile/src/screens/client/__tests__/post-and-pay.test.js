// "Post + Pay (same Button)" — Kira, handwritten, 2026-07-26.
//
// Posting an open job now CHARGES the client's full budget in one tap. The
// TARGETED flow (browse a company, request a quote) charges nothing at post —
// the client pays only when they accept a quote in chat.
//
// Those two facts sat in the same screen and the copy did not distinguish them:
// an explainer reading "We place your payment on hold when you post" rendered
// unconditionally, including in the targeted flow where no money moves, while
// the hint text forty lines below it was correctly branched the whole time.
// These pin the distinction so it cannot collapse again.
import i18n from '../../../i18n';

describe('Post + Pay copy — the open-post flow', () => {
  it('names the amount on the CTA, because that tap charges it', () => {
    // The old rule was "no figure on the button — the total lives in the
    // sheet", written when posting took no money. A button that charges must
    // say what it charges.
    const label = i18n.t('postJob.ctaPostAndPayAmount', { amount: '$150' });
    expect(label).toContain('$150');
    expect(label.toLowerCase()).toMatch(/pay/);
  });

  it('tells the client the budget is charged now, not merely held', () => {
    const lead = i18n.t('postJob.escrowExplainerLead').toLowerCase();
    expect(lead).toMatch(/charge/);
    expect(lead).not.toMatch(/on hold/);
  });

  it('promises BOTH refund paths — the unused part, and the whole thing', () => {
    // These are the two ways money comes back (AMENDMENT 1). Promising only
    // the first would leave a client whose job nobody quotes believing their
    // budget is simply gone.
    const body = i18n.t('postJob.escrowExplainer').toLowerCase();
    expect(body).toMatch(/refund/);
    expect(body).toMatch(/nobody takes the job|no one takes the job/);
  });

  it('has specific copy for a declined card', () => {
    // A decline on THIS path must not read like the accept-a-quote path: there
    // the booking already exists and is left unpaid, here no post is created.
    expect(i18n.t('postJob.chargeDeclined').toLowerCase()).toMatch(/declined/);
    expect(i18n.t('postJob.holdFailed').toLowerCase()).toMatch(/not posted|was not posted/);
  });

  it('says the draft survives a failed charge', () => {
    expect(i18n.t('postJob.holdFailed').toLowerCase()).toMatch(/draft/);
  });
});

describe('Post + Pay copy — the success state', () => {
  it('no longer claims a hold', () => {
    const body = i18n.t('postJob.postedBodyHeld').toLowerCase();
    expect(body).not.toMatch(/on hold/);
    expect(body).toMatch(/charged/);
  });

  it('tells the client unused budget comes back', () => {
    expect(i18n.t('postJob.postedRowHoldSub').toLowerCase()).toMatch(/refund/);
  });
});

describe('the targeted flow must not inherit any of it', () => {
  it('its CTA is a request, not a payment', () => {
    const label = i18n.t('postJob.ctaSendRequest').toLowerCase();
    expect(label).toMatch(/request/);
    expect(label).not.toMatch(/pay/);
  });

  it('the screen gates the charge explainer on the open-post path', () => {
    // Structural, not textual: the explainer must be behind a
    // !targetBusinessName guard. Reading the source is the only way to assert
    // "this does not render in the other flow" without standing up both.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'PostJobScreen.js'),
      'utf8',
    );
    const guard = src.indexOf('{!targetBusinessName && (');
    const explainer = src.indexOf('styles.escrowExplainer}');
    expect(guard).toBeGreaterThan(-1);
    expect(explainer).toBeGreaterThan(guard);
    expect(explainer - guard).toBeLessThan(400); // the guard wraps THIS block
  });
});
