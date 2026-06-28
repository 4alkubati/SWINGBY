# HUMAN-TODO — what's waiting on Kira

> The loop parks here anything only a human can do, and keeps working on everything else. Surfaced in the morning brief. Each item has the exact action.
> Cleaned 2026-06-27 (D2.5): ticked off 4 mobile fixes + CHECK bug (shipped in commits `214fdb6`, `340e537`). Added D2.0 walkthrough + D2.5 commit.

## ⛔ Blocking (loop stuck until done)

- [ ] **(Bucket C — push the D2.5 cleanup commit)** This session rewrote `STATUS.md` + `HUMAN-TODO.md` to reality + backfilled `Roadmap/June/` daily files + locked D2.4 NEEDS-KIRA in `Roadmap/dominoes/D2.4-business-subscription.md`. Plus the working tree carries `PRODUCT-VISION.md` (Payment model section) + `CLAUDE.md` (auto-tweaks) + `Roadmap/README.md` + `Roadmap/DOMINOES.md` + `Roadmap/dominoes/*` (all 7 dominos) + new `docs/` files (API, SECURITY, SESSIONS). Suggested commit:
  ```
  git add Roadmap/ AGENTS/claude/memory/STATUS.md AGENTS/claude/memory/HUMAN-TODO.md \
          AGENTS/claude/PRODUCT-VISION.md CLAUDE.md docs/
  git commit -m "docs(D2.5): rewrite STATUS to reality, lock D2.4, backfill Jun 21-30, add DOMINOES plan"
  git push origin main
  ```
  `credentials/` is gitignored, do not stage it.

- [ ] **(Bucket B — D2.0 walkthrough)** Tap through every screen of the SwingBy mobile app on **Expo Go iOS pointed at Render**, file bug list to `Roadmap/June/2026-06-26.md`. Steps in `Roadmap/dominoes/D2.0-live-walkthrough.md`. Without this we're stacking new features on latent bugs.

- [ ] **(Bucket B — seed creds: documented accounts MISSING from Supabase Auth)** `auth.users` has zero rows for `client@swingby.app`, `business@swingby.app`, `employee@swingby.app` (the accounts spec'd in `credentials/test-accounts/seed-accounts.md`). **Action:** Supabase dashboard → Authentication → Users → Add user × 3. Use the passwords from the credentials file. Check **"Auto Confirm User"**. Once created, the smoke test runs against local OR Render: `BASE_URL=… CLIENT_EMAIL=client@swingby.app CLIENT_PASSWORD=SwingbyClient2026 BIZ_EMAIL=business@swingby.app BIZ_PASSWORD=SwingbyBusiness2026 python backend/scripts/smoke_e2e.py`.

- [ ] **(Bucket B — Stripe keys + account)** P2 + D2.4 both depend on this. To turn it on:
  1. Create Stripe test account at https://dashboard.stripe.com if missing.
  2. Dashboard → Developers → API keys → reveal `sk_test_…` → Render env `STRIPE_SECRET_KEY`.
  3. Dashboard → Developers → Webhooks → Add endpoint → `https://swingbyy-api.onrender.com/payments/stripe/webhook`, events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`. Reveal signing secret `whsec_…` → Render env `STRIPE_WEBHOOK_SECRET`.
  4. (Optional) `STRIPE_SUCCESS_URL` + `STRIPE_CANCEL_URL` for non-default landing pages.
  5. For D2.4 — create TWO products (Solo $30/mo + Team $80/mo CAD recurring) → copy price IDs → Render env `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_TEAM`.
  6. Redeploy (push covers this). Tap "Pay with card" → test card `4242 4242 4242 4242` → payments row flips to `paid_full`.

## 🔑 Optional / when convenient

- [ ] **(D2.4 confirm — default if silent)** Beta posture for business subscription. Current default: **track-only during beta** (every business stays `trialing`, no Stripe charge until public launch). If you'd rather flip Stripe Checkout on during beta so testers actually subscribe with a test card — say so and we'll wire it in D2.4 step 1.

- [ ] **DMARC record (stops emails landing in spam)** — Cloudflare → swingbyy.com → DNS → Add → TXT · name `_dmarc` · content `v=DMARC1; p=none;`

- [ ] **Install impeccable design skill** (free). In Git Bash from repo root: `npx impeccable@latest` OR download the Claude Code ZIP from impeccable.style → extract so it lands at `Swingby/.claude/skills/impeccable/`. Then the design-agent uses `/impeccable shape|audit|critique|polish`. Skill pointer already wired: `AGENTS/claude/skills/impeccable-design.md`.

- [ ] **Qwen 3 overnight wiring (deferred 2026-06-27)** — local Qwen drains memory. Strategy locked: fallback on Anthropic limit hit (Claude default, Qwen takes the cycle that would otherwise sleep 15 min). Revisit when memory situation is sorted — smaller local Qwen variant, OpenRouter, or DashScope.

## ⏸️ Deferred — DO NOT spend money until the mobile app is finished + testers lined up

- Apple Developer ($99/yr), Google Play ($25), EAS/TestFlight dev build. Test free on your own phone first via `npx expo run:android` or Expo Go (which is what D2.0/D3 use).

## ✅ Done

- ✅ 4 mobile + qa fixes (JobManagement dead button, BookingDetails Pay gate + paymentPill schema, smoke 401 hint) — commit `214fdb6`
- ✅ CHECK constraint extended to allow `'refunded'` on `bookings.payment_status` — commit `340e537`
- ✅ D1 — 5 lifecycle transactional emails wired — commit `08715e3`
- ✅ Trust layer (events + photos) + Stripe sandbox scaffold — commit `554453b`
- ✅ Mobile bucket reorg (9 buckets, zero flat top-level) — commit `938799e`
- ✅ Supabase: Confirm email ON + URL config
- ✅ Render: RESEND_API_KEY + RESEND_FROM_EMAIL
- ✅ Branded email delivers (magic link from team@swingbyy.com)
- ✅ D2.4 NEEDS-KIRA × 3 answered (monetization model, tier prices, gate)

---
*[[MAP]] · filled by [[LOOP]] · surfaced in the [[_AUTOMATION]] morning brief*
