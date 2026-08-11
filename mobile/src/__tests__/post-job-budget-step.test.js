// F087 / F086 regression — PostJobScreen's Budget step.
//
// F087: the Budget & timing subhead said "Optional — helps businesses tailor
// their quote." directly above a field labeled "Budget *" and enforced by
// validateDraft() as required (> $0). The label lied.
//
// F086: validateDraft() and submitTargetedRequest's catch both route the
// user to the Budget or Confirm step on failure, but only StepDetails ever
// accepted/rendered a `descError` prop — so the error text rendered on a step
// the user was no longer looking at. Fixed by threading `descError` into
// StepBudget (TextField `error` prop) and StepConfirm (inline banner above
// the submit button), matching what StepDetails already did.
//
// Static source assertions, same style as post-job-date.test.js — the wizard
// steps aren't exported and a full render pulls in navigation/api mocking
// this fix doesn't need.

import fs from 'fs';
import path from 'path';

const SCREEN = path.join(__dirname, '..', 'screens', 'client', 'PostJobScreen.js');
const src = fs.readFileSync(SCREEN, 'utf8');

describe('Budget step subhead no longer calls the whole step optional', () => {
  it('does not claim the step is Optional right above the required Budget field', () => {
    expect(src).not.toMatch(/Optional\s*—\s*helps businesses tailor their quote/);
  });

  it('says budget is required', () => {
    const budgetStepMatch = src.match(/function StepBudget\([\s\S]*?\n}\n/);
    expect(budgetStepMatch).toBeTruthy();
    expect(budgetStepMatch[0]).toMatch(/Budget is required/i);
  });
});

describe('validation errors reach the step the user actually lands on', () => {
  it('StepBudget accepts and renders descError', () => {
    const fn = src.match(/function StepBudget\(\{[^}]*\}\)/)[0];
    expect(fn).toMatch(/descError/);

    const body = src.match(/function StepBudget\([\s\S]*?\n}\n/)[0];
    // Wired into the Budget TextField's error prop, same pattern as StepDetails.
    expect(body).toMatch(/label="Budget \*"[\s\S]*?error=\{descError\}/);
  });

  it('StepConfirm accepts and renders descError', () => {
    const fn = src.match(/function StepConfirm\(\{[^}]*\}\)/)[0];
    expect(fn).toMatch(/descError/);

    const body = src.match(/function StepConfirm\([\s\S]*?\n}\n/)[0];
    expect(body).toMatch(/descError[\s\S]*?<Text[^>]*color="danger"[^>]*>\{descError\}<\/Text>/);
  });

  it('both render call sites pass descError down', () => {
    const budgetCall = src.match(/<StepBudget[\s\S]*?\/>/)[0];
    expect(budgetCall).toMatch(/descError=\{descError\}/);

    const confirmCall = src.match(/<StepConfirm[\s\S]*?\/>/)[0];
    expect(confirmCall).toMatch(/descError=\{descError\}/);
  });
});
