# HUMAN-TODO — what's waiting on Kira

> The loop parks here anything only a human can do, and keeps working on everything else. Surfaced in the morning brief. Each item has the exact action.

## ⛔ Blocking (loop stuck until done)
- [ ] **(Bucket C — deploy)** Push the trust-layer + P2 work to Render. From repo root: `git push origin main`. Stages 10 commits + this loop's uncommitted work (`backend/app/api/booking_events.py`, `backend/app/api/booking_photos.py`, `backend/app/api/payments_stripe.py`, `backend/app/services/stripe_service.py`, `backend/app/config.py`, `backend/app/main.py` wiring, `backend/requirements.txt`, `backend/scripts/smoke_e2e.py`, `docs/booking_events_and_photos.sql`, 3 mobile components, edits to `JobManagementScreen.js` + `BookingDetailsScreen.js`). Until pushed, `/uploads/image`, `/bookings/{id}/events`, `/bookings/{id}/photos`, `/payments/stripe/*` all stay absent on prod.
- [ ] **(Bucket B — seed creds)** Provide a confirmed client + business login so the smoke test can run against Render. Set env vars: `CLIENT_EMAIL` + `CLIENT_PASSWORD` and `BIZ_EMAIL` + `BIZ_PASSWORD`. Reason: Supabase "Confirm email" is ON, so fresh signups don't return access tokens for the script. Then: `BASE_URL=https://swingbyy-api.onrender.com python backend/scripts/smoke_e2e.py`.
- [ ] **(Bucket B — Stripe keys + account)** P2 backend + mobile Pay button are CODE-COMPLETE in the working tree (decision made for you: hosted Checkout, not native PaymentSheet — no Expo eject needed). To turn it on:
  1. Create Stripe test account at https://dashboard.stripe.com if you don't have one.
  2. From dashboard → Developers → API keys → reveal `sk_test_…`. Paste into Render env as `STRIPE_SECRET_KEY`.
  3. From dashboard → Developers → Webhooks → Add endpoint → URL `https://swingbyy-api.onrender.com/payments/stripe/webhook`, event `checkout.session.completed`. Reveal the signing secret `whsec_…`. Paste into Render as `STRIPE_WEBHOOK_SECRET`.
  4. (Optional) set `STRIPE_SUCCESS_URL` + `STRIPE_CANCEL_URL` if you want non-default landing pages.
  5. Redeploy Render (push covers this).
  6. Tap "Pay with card" in the app → Stripe Checkout opens → use test card `4242 4242 4242 4242` → payments row should flip to `paid_full`.

## 🔑 Optional / when convenient
- [ ] DMARC record (stops emails landing in spam) — Cloudflare → swingbyy.com → DNS → Add → TXT · name `_dmarc` · content `v=DMARC1; p=none;`
- [ ] Install **impeccable** design skill (1 command, no money). In Git Bash from repo root: `npx impeccable@latest` OR download the Claude Code ZIP from impeccable.style → extract so it lands at `Swingby/.claude/skills/impeccable/`. Then the design-agent uses `/impeccable shape|audit|critique|polish`. Skill pointer already wired: `AGENTS/claude/skills/impeccable-design.md`.
- [ ] Test **Fable 5** as the loop's model (it's built for long autonomous runs). 1) Confirm it's on your plan. 2) One small task: `claude --model claude-fable-5 -p "<small task>"`. 3) If cleaner + available, set `--model claude-fable-5` in `automation/run-overnight.sh`. Pricier ($10/$50 per M) — test before committing. Do NOT swap a loop that's mid-run.

## ⏸️ Deferred — DO NOT spend money until the mobile app is finished + testers lined up
- Apple Developer ($99/yr), Google Play ($25), EAS/TestFlight dev build. Test free on your own phone first via `npx expo run:android`.

## ✅ Done
- Supabase: Confirm email ON + URL config ✅
- Render: RESEND_API_KEY + RESEND_FROM_EMAIL ✅
- Branded email delivers (magic link from team@swingbyy.com) ✅

---
*[[MAP]] · filled by [[LOOP]] · surfaced in the [[_AUTOMATION]] morning brief*
