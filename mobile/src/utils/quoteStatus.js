// quoteStatus.js — what state a quote is in. One definition, two screens.
//
// MessagesScreen and ChatScreen each computed this, and they disagreed.
// MessagesScreen did the expiry arithmetic; ChatScreen's inline version only
// looked at `post_status` and never compared a clock. So on live data — post
// still `open`, quote's own window elapsed — the inbox greyed the quote out as
// "Expired" while opening the thread showed it live, with working Accept & pay
// and Decline buttons on a quote that had run out.
//
// ChatQuoteCard trusts the `status` prop verbatim (by design — it is a
// presentational component and the handoff specifies all four resolve states),
// so whichever screen computes it wrong renders it wrong.
//
// The handoff calls these four states out explicitly:
//   pending · accepted · expired · declined
// design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md §"The quote card (3a)".

const DAY_MS = 24 * 60 * 60 * 1000;

// A quote carries no expires_at of its own — it inherits the post's window,
// and falls back to created_at + 7d when the payload omits it (/interests/mine
// does not select expires_at).
export const DEFAULT_QUOTE_WINDOW_MS = 7 * DAY_MS;

/** Hours until `expiresAt`. Negative once past. `null` if unknown. */
export function hoursLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return ms / 3600000;
}

/** When this quote runs out, inheriting the post's window if it has none. */
export function quoteExpiry(interest, post) {
  if (post?.expires_at) return post.expires_at;
  const created = interest?.created_at ? new Date(interest.created_at).getTime() : null;
  if (!created || Number.isNaN(created)) return null;
  return new Date(created + DEFAULT_QUOTE_WINDOW_MS).toISOString();
}

/**
 * 'pending' | 'accepted' | 'expired' | 'declined'
 *
 * `expiresAt` is optional: pass it when the caller already computed one,
 * otherwise it is derived. The TIME CHECK is the part ChatScreen was missing —
 * a quote whose window has passed is expired even while its post is still open.
 */
export function resolveQuoteStatus(interest, post, expiresAt) {
  if (!interest) return null;
  if (interest.status === 'accepted') return 'accepted';
  if (interest.status === 'rejected') return 'declined';

  const postStatus = post?.status;
  if (postStatus && postStatus !== 'open' && postStatus !== 'matched') return 'expired';

  const left = hoursLeft(expiresAt !== undefined ? expiresAt : quoteExpiry(interest, post));
  if (left != null && left <= 0) return 'expired';
  return 'pending';
}

/** Resolved quotes stay visible but greyed — they are records, not actions. */
export function isResolved(status) {
  return status === 'declined' || status === 'expired';
}
