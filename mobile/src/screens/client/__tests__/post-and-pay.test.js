// Posting a job takes no money — 2026-07-29.
//
// This file used to pin the opposite. It was written for "Post + Pay (same
// Button)", which described an intention that was never built: the review step
// said "Post & pay $160" and "Your $160 budget is charged now", the pay sheet
// said "Hold payment" / "On hold today", and none of it was true. The
// charge-at-post trigger is gated OFF in backend/app/api/service_posts.py
// because it cannot capture without card-on-file, `payment_started` is always
// false, and money is taken at ACCEPT (services/acceptAndPay.js).
//
// A false statement about money is the worst thing a payments product can
// ship, and tests asserting it are how it survives review. These now pin the
// truth, in both directions: the copy must say what happens, and must not say
// what doesn't.
import i18n from '../../../i18n';

describe('the open-post flow tells the client nothing is charged', () => {
  it('has a CTA that names an action, not a payment', () => {
    const label = i18n.t('postJob.ctaPost').toLowerCase();
    expect(label).toMatch(/post/);
    expect(label).not.toMatch(/pay|charge|hold/);
  });

  it('keeps every figure off that CTA', () => {
    // A number on the button is how it read as a charge, whatever the verb.
    expect(i18n.t('postJob.ctaPost')).not.toMatch(/\d|%\{amount\}|\$/);
  });

  it('says outright that nothing is charged now', () => {
    const lead = i18n.t('postJob.escrowExplainerLead').toLowerCase();
    expect(lead).toMatch(/nothing is charged/);
  });

  it('names accepting a quote as the moment money moves', () => {
    const body = i18n.t('postJob.escrowExplainer').toLowerCase();
    expect(body).toMatch(/accept/);
    // The old copy's specific lies: charged/held AT POST, refunded afterwards.
    expect(body).not.toMatch(/on hold|held|refund/);
  });

  it('repeats it in the hint under the button', () => {
    const hint = i18n.t('postJob.hintOpen').toLowerCase();
    expect(hint).toMatch(/not charged until you accept|until you accept/);
  });

  it('has no strings left from the charge-at-post copy', () => {
    // These four described a charge that cannot happen. They were deleted
    // rather than reworded so no screen can revive the claim by name.
    for (const key of [
      'postJob.ctaPostAndPay',
      'postJob.ctaPostAndPayAmount',
      'postJob.chargeDeclined',
      'postJob.holdFailed',
    ]) {
      expect(i18n.t(key)).toMatch(/missing|translation/i);
    }
  });
});

describe('the pay sheet in hold mode is a review, not a checkout', () => {
  it('does not claim a hold in its title or CTA', () => {
    expect(i18n.t('pay.titleHold').toLowerCase()).not.toMatch(/hold|pay/);
    expect(i18n.t('pay.ctaHold').toLowerCase()).not.toMatch(/hold|pay|charge/);
  });

  it('labels the amount as the budget, not money taken', () => {
    const label = i18n.t('pay.onHoldToday').toLowerCase();
    expect(label).toMatch(/budget/);
    expect(label).not.toMatch(/on hold/);
  });

  it('has its own caption that promises no charge', () => {
    const caption = i18n.t('pay.escrowHold').toLowerCase();
    expect(caption).toMatch(/nothing is charged/);
    // The pay-mode caption still describes escrow; hold mode must not reuse it.
    expect(caption).not.toEqual(i18n.t('pay.escrow').toLowerCase());
  });

  it('takes no payment method and welds no figure to the CTA', () => {
    // Structural: reading the source is the only way to assert "this does not
    // render" without standing the sheet up. `takesPayment` gates the card
    // picker, the no-method hint, the confirm guard, and the CTA amount.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'components', 'PaySheet.js'),
      'utf8',
    );
    expect(src).toMatch(/const takesPayment = mode !== 'hold'/);
    expect(src).toMatch(/quote && takesPayment \?/);
    expect(src).toMatch(/\{takesPayment && \(/);
    expect(src).toMatch(/takesPayment \? i18n\.t\('pay\.escrow'\)/);
  });
});

describe('the targeted flow, which was right all along', () => {
  it('its CTA is a request, not a payment', () => {
    const label = i18n.t('postJob.ctaSendRequest').toLowerCase();
    expect(label).toMatch(/request/);
    expect(label).not.toMatch(/pay/);
  });

  it('its hint is now a catalogue string, not a hardcoded literal', () => {
    // It was an English template literal in the screen while its neighbours
    // were translated — the app ships en / fr-CA / ar.
    const hint = i18n.t('postJob.hintTargeted', { business: 'Acme' });
    expect(hint).toMatch(/Acme/);
    expect(hint.toLowerCase()).toMatch(/nothing is charged until you accept/);
  });

  it('both paths now make the same promise', () => {
    const open = i18n.t('postJob.hintOpen').toLowerCase();
    const targeted = i18n.t('postJob.hintTargeted', { business: 'Acme' }).toLowerCase();
    expect(open).toMatch(/until you accept/);
    expect(targeted).toMatch(/until you accept/);
  });

  it('the screen still gates the explainer to the open-post path', () => {
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
