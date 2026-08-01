// One quote, two screens, one answer.
//
// MessagesScreen and ChatScreen each computed a quote's state, and they
// disagreed: MessagesScreen did the expiry arithmetic, ChatScreen's inline
// copy only looked at `post_status` and never compared a clock. On live data —
// post still open, the quote's own window elapsed — the inbox greyed the quote
// out as "Expired" while opening the thread showed it live, with working
// "Accept & pay" and "Decline" buttons on a quote that had run out.
//
// ChatQuoteCard trusts the `status` prop verbatim by design (it is
// presentational, and the handoff specifies all four resolve states), so
// whichever screen computes it wrong renders it wrong.

import fs from 'fs';
import path from 'path';

import {
  resolveQuoteStatus,
  quoteExpiry,
  hoursLeft,
  isResolved,
  DEFAULT_QUOTE_WINDOW_MS,
} from '../quoteStatus';

const OPEN = { status: 'open' };
const hoursFromNow = (h) => new Date(Date.now() + h * 3600000).toISOString();

describe('resolveQuoteStatus', () => {
  it('is pending while the window is open', () => {
    expect(resolveQuoteStatus({ status: 'pending' }, { ...OPEN, expires_at: hoursFromNow(20) }))
      .toBe('pending');
  });

  it('EXPIRES on the clock even while the post is still open', () => {
    // The exact case ChatScreen missed.
    expect(resolveQuoteStatus({ status: 'pending' }, { ...OPEN, expires_at: hoursFromNow(-1) }))
      .toBe('expired');
  });

  it('expires when the post is no longer open or matched', () => {
    expect(resolveQuoteStatus({ status: 'pending' }, { status: 'cancelled' })).toBe('expired');
  });

  it('accepted and declined win over any timing', () => {
    const dead = { ...OPEN, expires_at: hoursFromNow(-100) };
    expect(resolveQuoteStatus({ status: 'accepted' }, dead)).toBe('accepted');
    expect(resolveQuoteStatus({ status: 'rejected' }, dead)).toBe('declined');
  });

  it('derives the expiry when the caller does not supply one', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600000).toISOString();
    // No expires_at on the post: falls back to created_at + 7d, which has passed.
    expect(resolveQuoteStatus({ status: 'pending', created_at: eightDaysAgo }, OPEN))
      .toBe('expired');
  });

  it('returns null for no quote rather than guessing', () => {
    expect(resolveQuoteStatus(null, OPEN)).toBeNull();
  });
});

describe('quoteExpiry', () => {
  it("prefers the post's own window", () => {
    const at = hoursFromNow(5);
    expect(quoteExpiry({ created_at: hoursFromNow(-1) }, { expires_at: at })).toBe(at);
  });

  it('falls back to created_at + 7 days', () => {
    const created = new Date(Date.now()).toISOString();
    const got = new Date(quoteExpiry({ created_at: created }, {})).getTime();
    expect(got - new Date(created).getTime()).toBe(DEFAULT_QUOTE_WINDOW_MS);
  });

  it('is null when there is nothing to go on', () => {
    expect(quoteExpiry({}, {})).toBeNull();
  });
});

describe('hoursLeft / isResolved', () => {
  it('goes negative once past', () => {
    expect(hoursLeft(hoursFromNow(-2))).toBeLessThan(0);
    expect(hoursLeft(null)).toBeNull();
  });

  it('treats declined and expired as records, not actions', () => {
    expect(isResolved('declined')).toBe(true);
    expect(isResolved('expired')).toBe(true);
    expect(isResolved('pending')).toBe(false);
    expect(isResolved('accepted')).toBe(false);
  });
});

describe('both screens use the shared function', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

  it.each([['screens/messages/MessagesScreen.js'], ['screens/messages/ChatScreen.js']])(
    '%s imports it instead of keeping a copy',
    (file) => {
      const src = read(file);
      expect(src).toMatch(/from '\.\.\/\.\.\/utils\/quoteStatus'/);
      // A local redefinition is how they drifted apart the first time.
      expect(src).not.toMatch(/function resolveQuoteStatus\s*\(/);
    },
  );
});
