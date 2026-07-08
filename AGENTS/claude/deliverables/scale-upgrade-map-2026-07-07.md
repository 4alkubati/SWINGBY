# Scale & Upgrade Map — 2026-07-07

> Kira asked: make the app user-friendly, scalable to other countries (language + usage), support
> "small business hires other providers for a big job," and make execution faster. This is the
> sequenced answer. Read top to bottom; each tier is gated by the one above it.

---

## The honest frame (read this first)

International scale is a **comfortable worry** (KIRA.md pattern: safe scaffolding vs. scary real work).
The scary real work is: **real Calgary testers completing real bookings.** Nothing below is allowed
to delay that. BUT — some scale decisions are 100× cheaper if made *now* as architecture rules than
retrofitted later. So the map is: **lock the cheap rules now, build the features after beta proof.**

What today's audit proved: the app's core loop now works end-to-end (post → quote → chat → accept →
booking → live status → complete → escrow release, all verified by `tools/e2e_smoke.py`). The
foundation is real. That's the self-proof: the hard part is behind you.

---

## TIER 0 — Now, costs almost nothing (architecture locks, not builds)

These are *rules for agents*, not features. Each one prevents a future rewrite.

1. **i18n string rule.** `mobile/src/i18n.js` exists (EN + AR) but only SettingsScreen uses it —
   every other screen hardcodes English. Retrofitting 56 screens later = weeks. The rule:
   **every NEW or EDITED user-facing string goes through `i18n.t()`** with an EN entry. Existing
   screens migrate opportunistically (when an agent touches a screen, it converts that screen's
   strings). Zero schedule impact, stops the debt growing. RTL (Arabic layout) stays deferred.

2. **Money is not a bare number.** Amounts are stored as floats with `$` hardcoded in the UI.
   Rule: new code formats money through one helper (`formatMoney(amount, currency='CAD')` in
   mobile, one place). Add a `currency text default 'CAD'` column to `bookings` + `payments` when
   the next migration happens anyway. Stripe already supports multi-currency — the blocker would
   only ever be our own hardcoding.

3. **Category taxonomy in ONE place.** Categories are the thing that changes most per country
   (trades licensing, terminology). Keep the category list in a single module/table, never inline
   in screens. Per-country catalogs later become a data change, not a code change.

4. **Posts are not client-only forever.** `POST /service-posts/` is 403 for business owners.
   Keep that for beta, but agents must NOT bake "poster == client" assumptions into new code
   (queries, notifications, UI copy). This is the cheap door to the crews feature (Tier 2).

5. **Already right, keep it right:** phone = E.164 ✓, distance = km ✓, timestamps = UTC tz-aware ✓,
   auth = standard JWT ✓. Address is free-text — fine; do NOT build structured address parsing.

---

## TIER 1 — Beta user-friendliness (the next build blocks)

Ranked by "will a Calgary tester quit here?"

1. **Signup dead-ends without email confirmation.** Supabase confirmation is ON → signup returns
   no token → the app can't auto-login and the user stares at a login screen wondering why their
   fresh password "doesn't work." Either (a) turn confirmation OFF for beta, or (b) build a
   "check your email" screen + resend button. **(a) is one dashboard toggle — recommended for beta.**
   → NEEDS-KIRA: one decision.

2. **Push notifications must deep-link.** "New quote on your job" should open QuoteComparison,
   not the home screen. The notification tap handler + route mapping is a half-day agent task and
   it's the single strongest engagement hook a marketplace has (this is what Thumbtack does best).

3. **The quotes moment needs to feel like winning.** When quotes arrive, the client should see it
   without digging: badge on My Jobs tab + the existing Notifications feed already counts quotes
   (fixed today). Small: add quote count polling to the tab badge.

4. **Empty states that sell, not apologize.** First-run Home with no nearby businesses (cold-start
   city) should route to "post a job" — the post-and-match flow is the one that works with zero
   supply. One screen edit.

5. **Offline/slow-network grace.** Retry interceptor exists ✓. Keep skeletons + stale-cache pattern
   (Dashboard already does this) as the standard for new screens.

---

## TIER 2 — The crews feature (post-beta flagship, v2)

**"A small business can pull other providers into a big job."** This is the genuinely
differentiating idea — Thumbtack/TaskRabbit/Jobber have nothing here. And the schema is ~80% ready
because SwingBy already models "post work → collect offers → accept → booking":

- A business posts a **crew call** (a `service_post` with `post_type='crew_call'`, poster =
  business instead of client, budget = subcontract rate).
- Other businesses express interest with quotes — the existing `interests` table as-is.
- Accepting creates a **linked booking** (`bookings.parent_booking_id` → the client-facing job),
  so one client job can have N sub-bookings underneath it.
- Live Job Status + before/after photos roll up from sub-bookings to the parent — the trust layer
  becomes the coordination layer. Escrow split across crew members comes last (licensed processor
  question, post-beta anyway).

Schema delta: 2 columns (`service_posts.post_type`, `bookings.parent_booking_id`), one permission
change, one new screen (Crew tab on the business side). **Do not build until the two-sided beta
loop has real usage** — a crews feature with zero businesses is scaffolding.

---

## TIER 3 — Country expansion (only after Calgary works)

When Tier 0 rules have been followed, entering a country is: translate `i18n.js` catalog + category
catalog, set currency, check Stripe availability, seed supply. The order of expansion pain:
supply seeding >> payments >> language. That's a marketing/ops problem, not a code problem —
which is exactly where you want it to be.

---

## Execution-speed upgrades (the KIRA.md ask) — what changed today

1. **`tools/e2e_smoke.py` (committed).** The full booking loop, response *shapes* included, runs
   in ~15s against a local backend. Wired into DISPATCH_GATE Layer 6: agents cannot mark
   booking-loop work DONE without it passing. This converts your class of "simple yet not executed
   properly" bugs from *things Kira finds in the evening* into *things agents fix at 3am*.
2. **Flow graph stays the nav authority** (0 broken edges / 0 orphans as of today); the smoke test
   covers what it can't see (payload drift).
3. **Docs now match reality.** Test accounts were dead → recreated exactly as CLAUDE.md documents.
   Rule for agents: when a documented fact is found false, fix the fact or the world *in the same
   session* — stale docs burn overnight runs.
4. **Root-cause fixed, remembered.** The shared-Supabase-client session hijack (one login degraded
   ALL backend queries to that user's RLS view) is fixed, tested, and written to agent memory so
   it can never be reintroduced silently.

**The remaining bottleneck is not agent speed — it's decision latency.** The system can build
overnight; it stalls on NEEDS-KIRA items. Keep the evening window brutal: every brief ends with
at most 3 yes/no decisions.

---

## NEEDS-KIRA (the only decisions in this doc)

1. Email confirmation for beta: **turn OFF** (recommended) or build the confirm screen?
2. Commit today's fixes + this map? (Working tree has the audit fixes + smoke gate, all tests green.)
3. Tier 1 items 2–4 as the next overnight blocks — approve the order?

*[[MAP]] · referenced from DISPATCH_GATE Layer 6 · smoke test: `tools/e2e_smoke.py`*
