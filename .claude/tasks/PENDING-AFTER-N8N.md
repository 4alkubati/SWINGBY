# Pending — pick up after the n8n phase

Saved for "let's continue" — not blockers, just work to come back to.

## Right after Phase 2 (5 min each)

- [ ] **Rotate admin password.** Current temp: `Swingby123`. Log in to `web/admin`, change to something stronger. Or trigger forgot-password flow at `web/launch/forgot-password`.
- [ ] **Sign up for Resend.** resend.com → verify `swingby.ca` (5 DNS records via Cloudflare, ~10 min). Drop `RESEND_API_KEY` into `backend/.env` and `.claude/secrets/social-credentials.txt`.
- [ ] **Enable Cloudflare Web Analytics.** Cloudflare dashboard → Analytics & Logs → Web Analytics → add site `swingby.ca`. No code change needed if the zone is already proxied.

## Marketing fill-ins (15 min each)

- [ ] `marketing/MARKETING-PLAN.md:260` — Add team + advisors section
- [ ] `marketing/MARKETING-PLAN.md:263` — Funding ask + use of funds (or delete if not raising)
- [ ] `privacy-and-security/privacy-policy.md:15` — Incorporated mailing address

## Backend roadmap (later — when API features need real backends)

- [ ] `web/launch/src/pages/app/ApiKeys.jsx` — wire `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/{id}` + `business_api_keys` table
- [ ] `web/launch/src/pages/app/BusinessAnalytics.jsx` — add `GET /businesses/me/analytics` with SQL aggregation
- [ ] `web/launch/src/pages/app/BusinessIntegrations.jsx` — add `POST /webhooks` + webhooks table

## Future-Stripe sequence (after business email is provisioned)

- [ ] Get business email (Google Workspace or similar)
- [ ] Sign up at stripe.com → Connect Express onboarding
- [ ] Wire `backend/app/api/payments.py` to real Stripe API
- [ ] Update `privacy-and-security/subprocessors.md` Stripe section: "Not yet integrated" → live
- [ ] End-to-end test escrow flow with real test cards
