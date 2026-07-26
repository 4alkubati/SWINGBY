---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market, ops]
---
# 13 — Accounts and Identity

> The registry of every domain, mailbox, and social account SwingBy owns. One page, checked against live DNS on 2026-07-25. If a channel isn't listed here, we don't own it.

Related: [09-brand-guidelines.md](09-brand-guidelines.md) · [12-social-media-playbook.md](12-social-media-playbook.md) · [14-automation-stack.md](14-automation-stack.md)

---

## The domain question, settled

The plan called for `privacy@swingby.com` and `amr@swingby.com`. **We do not own swingby.com and cannot get those addresses.** Live DNS as of 2026-07-25:

| Domain | Status | Evidence |
|---|---|---|
| `swingby.com` | **Owned by someone else** | A `74.208.236.34`, MX `mx00.1and1.com`, NS `ns29/ns30.1and1.com` (IONOS). Live mail already routes there. |
| `swingby.ca` | **Owned by someone else** | NS `ns61/ns62.domaincontrol.com` (GoDaddy), A on AWS Global Accelerator |
| `swingby.app` | **Owned by someone else** | NS `awsdns`, A on AWS CloudFront range |
| `swingbyy.com` | ✅ **Ours** | NS `julissa/jakub.ns.cloudflare.com`, Cloudflare Email Routing MX live, SPF + DKIM + DMARC published, Google site verification present |
| `swingbyapp.com` | **Unregistered** | No NS records — nobody owns it |
| `swingbyapp.ca` | **Unregistered** | No NS records — nobody owns it |

**Decision: `swingbyy.com` is the canonical domain.** It's the one that's already deployed, already verified, already has mail routing, and is already hardcoded as the Resend sender in `backend/app/config.py:100` (`SwingBy <hello@swingbyy.com>`). Everything else is renamed to match it, not the other way around.

Buying `swingby.com` from its current owner is a separate, later conversation — a live-mail domain on a premium two-word .com is a four-or-five-figure ask, and nothing about launch depends on it.

### The swingbyapp.com problem

`support@swingbyapp.com` appears **238 times** across the vault and in 4 files on `main` — on a domain **nobody has registered**. If we publish any of that, anyone can register `swingbyapp.com` for ~$12 and start receiving mail addressed to SwingBy support: password reset threads, dispute complaints, client contact details. That is a live data-exposure path, not a typo.

Two actions:
1. **Rename all of them to `@swingbyy.com`** (done on the `worktree-marketing-ops` branch — see the sweep at the bottom of this page).
2. **Register `swingbyapp.com` and `swingbyapp.ca` defensively** (~$25/yr total) and park them as redirects to `swingbyy.com`. Cheap insurance, and it closes the impersonation path permanently.

---

## Mailbox map

All of these are **Cloudflare Email Routing** aliases on `swingbyy.com` — free, unlimited, forwarding to a destination inbox. There is no mailbox to log into; each alias forwards. Set them up at Cloudflare → swingbyy.com → Email → Routing rules.

| Address | Purpose | Forwards to | Public? |
|---|---|---|---|
| `hello@swingbyy.com` | General inbound; Resend `From` address | Amr | ✅ website footer |
| `support@swingbyy.com` | Customer support, in-app help links | Amr (later: shared inbox) | ✅ app + web |
| `privacy@swingbyy.com` | PIPEDA/GDPR data requests, deletion requests | Amr | ✅ privacy policy (legally required) |
| `legal@swingbyy.com` | Terms disputes, formal notices | Amr | ✅ terms of service |
| `security@swingbyy.com` | Vulnerability reports | Amr | ✅ `/.well-known/security.txt` |
| `press@swingbyy.com` | Media enquiries | Amr | ✅ press kit |
| `partnerships@swingbyy.com` | Chambers of commerce, trade schools, suppliers | Amr | ✅ partnerships page |
| `careers@swingbyy.com` | Inbound applications | Amr | ✅ when hiring |
| `accessibility@swingbyy.com` | AODA/WCAG feedback | Amr | ✅ accessibility statement |
| `billing@swingbyy.com` | Stripe receipts, invoices, chargeback notices | Amr | ❌ internal |
| `noreply@swingbyy.com` | Transactional send-only; no routing rule | — | ❌ send-only |
| `dmarc-reports@swingbyy.com` | DMARC aggregate reports (already in the DMARC record) | Amr (filter to a label) | ❌ machine |
| **`amr@swingbyy.com`** | **Founder identity. Every SaaS signup, every ad account, every app store, every bank/Stripe login.** | Amr | ❌ never published |

### The amr@ rule

`amr@swingbyy.com` is the account-of-record for anything that would be catastrophic to lose: Apple Developer, Google Play, Meta Business, Stripe, Cloudflare, Supabase, Render, the domain registrar. **Never use a role alias (`support@`, `hello@`) for a login**, and never use a personal Gmail either. Two reasons: role aliases get forwarded and eventually shared, and a personal address means the company's assets are legally attached to a person's consumer account.

Note: `4alkubati@gmail.com` and `amrbasem37@gmail.com` currently appear ~590 times across the vault as contact/owner addresses. Those are fine as *forwarding destinations*, not as the address on file with Apple or Stripe.

### Mail auth — current state

| Record | Status | Action |
|---|---|---|
| SPF | ✅ `v=spf1 include:_spf.mx.cloudflare.net ~all` | **Add Resend** before the first transactional send, or receipts land in spam: `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all` (Resend publishes the exact include in its dashboard — use theirs, not this guess) |
| DKIM | ✅ `cf2024-1._domainkey` present | Resend adds its own DKIM key at verification — both coexist fine |
| DMARC | ⚠️ `v=DMARC1; p=none;` | `p=none` monitors but enforces nothing. Leave it at `none` until Resend is verified and reports are clean, then move to `p=quarantine`. Also add `rua=mailto:dmarc-reports@swingbyy.com` — it isn't in the record yet despite the alias being documented. |
| `www.swingbyy.com` | ❌ **Does not resolve** (curl → 000) | Add a CNAME `www → swingbyy.com` at Cloudflare. Anyone typing `www.` today gets a dead page. Five-minute fix, real lost traffic. |

---

## Social account registry

None of these are confirmed created — treat the whole table as a to-do list. **Claim the handles today even if we don't post for a month**; handle squatting on a launching brand is real and unrecoverable.

Handle preference order: `swingby` → `swingbyapp` → `getswingby` → `swingbyyc` (yyc = Calgary airport code, and locally legible).

| Platform | Handle | Signup email | Priority | Why |
|---|---|---|---|---|
| Instagram | `@swingbyapp` | `amr@swingbyy.com` | **P0** | Primary channel per [12-social-media-playbook.md](12-social-media-playbook.md); before/after content is the whole business |
| Facebook Page | `SwingBy` | `amr@swingbyy.com` | **P0** | Required for Meta Business + Instagram API access; Calgary neighbourhood groups are where clients actually are |
| Meta Business Suite | — | `amr@swingbyy.com` | **P0** | The container for IG + FB + ads + the Graph API tokens the n8n workflows need |
| TikTok | `@swingbyapp` | `amr@swingbyy.com` | P1 | 30-day scripts already written in `content-library/tiktok-30-day-scripts.md` |
| Google Business Profile | SwingBy | `amr@swingbyy.com` | **P0** | Free, and the single highest-intent local surface. Also feeds the hyperlocal SEO campaign. |
| LinkedIn Page | SwingBy | `amr@swingbyy.com` | P1 | Supply side — recruiting businesses, not clients |
| X/Twitter | `@swingbyapp` | `amr@swingbyy.com` | P2 | Low ROI for local services; claim the handle, post rarely |
| YouTube | `@swingbyapp` | `amr@swingbyy.com` | P2 | Long-form home; feeds Shorts/Reels/TikTok |
| Telegram bot | existing | — | ✅ **live** | Token already in the n8n container env |
| Discord server | SwingBy Ops | `amr@swingbyy.com` | P1 | Private ops console, not a community. See [14-automation-stack.md](14-automation-stack.md). |

### Bio and link — use everywhere, identically

```
SwingBy — Calgary's local services marketplace.
Post a job free. Get bids from nearby pros. Pay safely.
swingbyy.com
```

Link target: `https://swingbyy.com` (not a Linktree — one less dependency, and we control the page).

### Account hygiene, non-negotiable

- **Every account uses `amr@swingbyy.com`.** No exceptions, no personal Gmail.
- **2FA on all of them**, via an authenticator app — not SMS. SIM-swap is the standard attack on a founder with a payment processor.
- **Password manager, one vault.** The recovery codes for Apple, Google Play, Stripe and Cloudflare go in it. Losing an App Store account is unrecoverable.
- **Meta Business: add a second admin.** A Facebook Page with one admin is one account-lock away from being gone.
- **Never publish `amr@`.** It's a login, not a contact address. Public contact is `hello@` / `support@`.

---

## Sweep applied on this branch

Every SwingBy email address on a domain we don't own was renamed to `@swingbyy.com`:

| Was | Now | Files |
|---|---|---|
| `support@swingbyapp.com` | `support@swingbyy.com` | `marketing/launch/launch-day-linkedin.md`, `marketing/support/escalation-matrix.md`, `marketing/support/knowledge-base.md` |
| `security@swingbyapp.ca` | `security@swingbyy.com` | `web/launch/SECURITY.md` |
| `security@swingby.ca`, `support@swingby.ca` | `…@swingbyy.com` | `.claude/tasks/*.md` |
| `client@swingby.app`, `business@swingby.app` | `…@swingbyy.com` | `.claude/tasks/launch-site-brief.md`, `docs/LAUNCH_CHECKLIST.md`, `Roadmap/July/2026-07-02.md` |

`testclient@swingby.dev` / `testbusiness@swingby.dev` were **left alone** — they're seed fixtures for a domain that is intentionally fake and never receives mail.

---

## Human-only steps (nobody but Amr can do these)

1. Register `swingbyapp.com` + `swingbyapp.ca`, park as redirects to `swingbyy.com`.
2. Cloudflare → swingbyy.com → Email → create the routing rules in the mailbox map above.
3. Cloudflare → DNS → add `CNAME www → swingbyy.com`.
4. Cloudflare → DNS → add `rua=mailto:dmarc-reports@swingbyy.com` to the DMARC record.
5. Resend → verify `swingbyy.com`, then add the SPF include and DKIM record Resend gives you.
6. Claim the P0 handles: Instagram, Facebook Page, Meta Business Suite, Google Business Profile.
7. Turn on app-based 2FA everywhere; store recovery codes in the password manager.
