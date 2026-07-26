---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market, ops]
---
# 13 — Accounts and Identity

> The registry of every domain, mailbox, and social account SwingBy owns. One page, checked against live DNS and the .com registry on 2026-07-26. If a channel isn't listed here, we don't own it.

Related: [09-brand-guidelines.md](09-brand-guidelines.md) · [12-social-media-playbook.md](12-social-media-playbook.md) · [14-automation-stack.md](14-automation-stack.md)

---

## The domain question, settled

The plan called for `privacy@swingby.com` and `amr@swingby.com`. **We do not own swingby.com and cannot get those addresses.** Live DNS + Verisign RDAP as of 2026-07-26 (confirmed across three independent resolvers):

| Domain | Status | Evidence |
|---|---|---|
| `swingby.com` | **Owned by someone else** | Registered **1998-03-19**, registrar Network Solutions, paid through 2031. NS `ns29/ns30.1and1.com` (IONOS), MX `mx00/mx01.1and1.com`, SPF `include:_spf-us.ionos.com`. A 28-year-old domain with live mail — not for sale at a price that matters to us. |
| `swingby.ca` | **Owned by someone else** | NS `ns61/ns62.domaincontrol.com` (GoDaddy), A on AWS Global Accelerator |
| `swingby.app` | **Owned by someone else** | NS `awsdns`, A on AWS CloudFront range |
| `swingbyy.com` | ✅ **Ours** | Registered **2026-05-17** at NameCheap. NS `julissa/jakub.ns.cloudflare.com`, Cloudflare Email Routing MX live, SPF + DKIM + DMARC published, **Resend verified** (`resend._domainkey` + `send.swingbyy.com`), Google site verification present |
| `swingbyapp.com` | **Unregistered** | No NS records — nobody owns it |
| `swingbyapp.ca` | **Unregistered** | No NS records — nobody owns it |

**Decision: `swingbyy.com` is the canonical domain.** It's the one that's already deployed, already verified, already has mail routing and Resend sending, and is already hardcoded as the Resend sender in `backend/app/config.py:100` (`SwingBy <hello@swingbyy.com>`). Everything else is renamed to match it, not the other way around.

> **Watch the spelling.** `swingby.com` and `swingbyy.com` are easy to conflate in conversation, and the working setup — Cloudflare DNS, Cloudflare Email Routing, Resend, forwarding into Gmail — is entirely on the **double-y** domain. `swingby.com` has none of it: different registrar, different nameservers, IONOS mail, no Resend records. Anything typed as `@swingby.com` goes to a stranger's mail server.

Buying `swingby.com` from its current owner is not a near-term option. It was registered in 1998, sits with Network Solutions, is paid through 2031, and has live mail on it — that's a held, in-use asset, so any acquisition is a five-figure broker conversation at best. Nothing about launch depends on it.

### The swingbyapp.com problem

`support@swingbyapp.com` appears **238 times** across the vault and in 4 files on `main` — on a domain **nobody has registered**. If we publish any of that, anyone can register `swingbyapp.com` for ~$12 and start receiving mail addressed to SwingBy support: password reset threads, dispute complaints, client contact details. That is a live data-exposure path, not a typo.

Two actions:
1. **Rename all of them to `@swingbyy.com`** (done on the `worktree-marketing-ops` branch — see the sweep at the bottom of this page).
2. **Register `swingbyapp.com` and `swingbyapp.ca` defensively** (~$25/yr total) and park them as redirects to `swingbyy.com`. Cheap insurance, and it closes the impersonation path permanently.

---

## Mailbox map

All of these are **Cloudflare Email Routing** aliases on `swingbyy.com` — free, unlimited, forwarding to a destination inbox. There is no mailbox to log into; each alias forwards. Set them up at Cloudflare → swingbyy.com → Email → Routing rules.

**Destination inbox: `4alkubati@gmail.com`.** Everything below lands there. Add a Gmail filter per alias (Gmail matches on the `to:` header even for forwarded mail) so support, privacy, and billing don't blur into one stream.

| Address | Purpose | Forwards to | Public? |
|---|---|---|---|
| `hello@swingbyy.com` | ✅ **Live.** General inbound; the Resend `From` address | `4alkubati@gmail.com` | ✅ website footer |
| `support@swingbyy.com` | Customer support, in-app help links | `4alkubati@gmail.com` (later: shared inbox) | ✅ app + web |
| `privacy@swingbyy.com` | PIPEDA/GDPR data requests, deletion requests | `4alkubati@gmail.com` | ✅ privacy policy (legally required) |
| `legal@swingbyy.com` | Terms disputes, formal notices | `4alkubati@gmail.com` | ✅ terms of service |
| `security@swingbyy.com` | Vulnerability reports | `4alkubati@gmail.com` | ✅ `/.well-known/security.txt` |
| `press@swingbyy.com` | Media enquiries | `4alkubati@gmail.com` | ✅ press kit |
| `partnerships@swingbyy.com` | Chambers of commerce, trade schools, suppliers | `4alkubati@gmail.com` | ✅ partnerships page |
| `careers@swingbyy.com` | Inbound applications | `4alkubati@gmail.com` | ✅ when hiring |
| `accessibility@swingbyy.com` | AODA/WCAG feedback | `4alkubati@gmail.com` | ✅ accessibility statement |
| `billing@swingbyy.com` | Stripe receipts, invoices, chargeback notices | `4alkubati@gmail.com` | ❌ internal |
| `noreply@swingbyy.com` | Transactional send-only; no routing rule | — | ❌ send-only |
| `dmarc-reports@swingbyy.com` | DMARC aggregate reports — ⚠️ documented but **not yet in the DMARC record**, so no reports arrive | `4alkubati@gmail.com` (filter to a label) | ❌ machine |
| **`amr@swingbyy.com`** | **Founder identity. Every SaaS signup, every ad account, every app store, every bank/Stripe login.** | `4alkubati@gmail.com` | ❌ never published |

### The amr@ rule

`4alkubati@gmail.com` is the inbox Amr actually reads, and it stays the destination for everything above. The open question is only what address is **on file** as the owner of the critical accounts: Apple Developer, Google Play, Meta Business, Stripe, Cloudflare, Supabase, Render, NameCheap.

Recommendation: use `amr@swingbyy.com` for those, forwarding to the same Gmail. It costs nothing and reads the same in the inbox, but it buys two things a consumer Gmail can't:

- **Portability.** If the company ever needs a second admin, an accountant, a co-founder, or a buyer, the accounts move with the domain instead of being welded to one person's Google account.
- **Recovery.** If the Gmail is ever locked or compromised, the identity layer is a domain you control at Cloudflare, not a support queue at Google.

**Whichever address is chosen, use the same one everywhere and never a role alias.** `support@` and `hello@` get forwarded and eventually shared; a login that lands in a shared inbox is a login that leaks. That rule matters more than Gmail-vs-branded.

Note: `4alkubati@gmail.com` and `amrbasem37@gmail.com` appear ~590 times across the vault as contact/owner addresses. Anywhere they're printed as a *public contact* should become `hello@` or `support@` — a personal Gmail on a marketplace's contact page invites scraping.

### Mail auth — current state

Better than expected — inbound and outbound are both already wired. Two gaps remain.

| Record | Status | Action |
|---|---|---|
| Inbound MX | ✅ `route1/2/3.mx.cloudflare.net` | Cloudflare Email Routing is live; aliases forward to Gmail |
| SPF (apex) | ✅ `v=spf1 include:_spf.mx.cloudflare.net ~all` | Correct as-is. **Do not add an `amazonses.com` include here** — Resend sends from the `send.` subdomain, which carries its own SPF. Editing the apex would be a no-op at best. |
| Resend DKIM | ✅ `resend._domainkey.swingbyy.com` published | None — domain is verified |
| Resend send subdomain | ✅ `send.swingbyy.com` → SPF `include:amazonses.com`, MX `feedback-smtp.us-east-1.amazonses.com` | None. Bounce/complaint feedback is wired, which is what keeps sender reputation clean. |
| Cloudflare DKIM | ✅ `cf2024-1._domainkey` present | None — coexists with Resend's key fine |
| DMARC | ⚠️ `v=DMARC1; p=none;` | Two gaps: no `rua=`, so **nobody is receiving the reports** despite `dmarc-reports@` being documented; and `p=none` enforces nothing. Set `v=DMARC1; p=none; rua=mailto:dmarc-reports@swingbyy.com;` now, read reports for two weeks, then move to `p=quarantine`. |
| `www.swingbyy.com` | ❌ **Does not resolve** (curl → 000; apex returns 200) | Add a CNAME `www → swingbyy.com` at Cloudflare, proxied. Anyone typing `www.` today gets a dead page. Five-minute fix, real lost traffic. |

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

Already done, no action needed: domain, Cloudflare DNS, Cloudflare Email Routing, `hello@`, and Resend verification (DKIM + `send.` subdomain + bounce handling).

1. Cloudflare → DNS → add `CNAME www → swingbyy.com`, proxied. **(www is dead right now.)**
2. Cloudflare → DNS → set DMARC to `v=DMARC1; p=none; rua=mailto:dmarc-reports@swingbyy.com;` — nobody is receiving reports today.
3. Cloudflare → Email → add the remaining routing rules from the mailbox map (`support@`, `privacy@`, `legal@`, `security@`, `billing@`, `dmarc-reports@` at minimum — those four public ones are cited in the legal docs and the app).
4. Register `swingbyapp.com` + `swingbyapp.ca` (~$25/yr), park as redirects to `swingbyy.com`.
5. Claim the P0 handles: Instagram, Facebook Page, Meta Business Suite, Google Business Profile.
6. Turn on app-based 2FA everywhere; store recovery codes in a password manager.
7. Decide the login identity question above (`amr@swingbyy.com` vs `4alkubati@gmail.com`) and use one address consistently from here on.
