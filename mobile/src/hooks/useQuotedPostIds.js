// The set of post ids this business has already quoted on — the one thing that
// decides whether an open post is still a *lead*.
//
// Walkthrough B12 (Jobs, fixed in 5c279ce) and B10 (Dashboard, this file): a
// post the business had already quoted kept sitting under "New opportunities"
// offering "Send quote" a second time, which the API answers with "You already
// expressed interest in this post". Both screens read `GET /service-posts/`,
// which knows nothing about who quoted; the only source for that is
// `GET /interests/mine`. So both screens fetch it purely to build this set and
// subtract it from the feed.
//
// Two behaviours worth keeping in one place rather than copy-pasted twice:
//
//  * `markQuoted` is the OPTIMISTIC path. The lead has to collapse the instant
//    the quote sheet reports success, not one network round-trip later.
//
//  * `syncFromInterests` UNIONS rather than replaces. A refetch that lands
//    before the new interest row is readable would otherwise resurrect the card
//    the user just quoted — the exact flicker B10 describes as "stale cache".
//    Interests are never deleted (there is no DELETE on the interests router),
//    so a union can't strand a stale id.

import { useState, useCallback } from 'react';

/**
 * @param {Iterable<string>} [initialIds] seed, e.g. from a screen's warm cache.
 */
export default function useQuotedPostIds(initialIds) {
  const [quotedPostIds, setQuotedPostIds] = useState(() => new Set(initialIds || []));

  /** Fold a `GET /interests/mine` payload (array, or `{items: [...]}`) in. */
  const syncFromInterests = useCallback((payload) => {
    const items = payload?.items || payload || [];
    if (!Array.isArray(items) || items.length === 0) return;
    setQuotedPostIds((prev) => {
      const next = new Set(prev);
      items.forEach((interest) => {
        const id = interest?.post_id || interest?.service_posts?.id;
        if (id) next.add(id);
      });
      return next;
    });
  }, []);

  /** Optimistically treat `postId` as quoted, before any refetch comes back. */
  const markQuoted = useCallback((postId) => {
    if (!postId) return;
    setQuotedPostIds((prev) => (prev.has(postId) ? prev : new Set(prev).add(postId)));
  }, []);

  return { quotedPostIds, syncFromInterests, markQuoted };
}
