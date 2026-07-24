# Email authentication (SPF / DKIM / DMARC) for swingbyy.com

Owner action doc. Transactional mail goes through **Resend** (which relays via
AWS SES under the hood). Inbound mail is handled by **Cloudflare Email Routing**.
DNS is at Cloudflare (zone `9a8b894bb479321547e40824477d46f5`).

Last verified from live DNS: **2026-07-23**.

---

## 1. What is live right now (measured, not assumed)

```
dig +short TXT _dmarc.swingbyy.com
  "v=DMARC1; p=none;"

dig +short TXT swingbyy.com
  "v=spf1 include:_spf.mx.cloudflare.net ~all"          # Cloudflare Email Routing (inbound)
  "google-site-verification=nIc4Uo8Cm_uAPoF3VQ9sGV1W9gAXdf3ewSRLvdfnFnQ"

dig +short TXT resend._domainkey.swingbyy.com
  "p=MIGfMA0GCSq...IDAQAB"                              # Resend DKIM — PRESENT, resolves

dig +short TXT send.swingbyy.com
  "v=spf1 include:amazonses.com ~all"                  # Resend/SES return-path (bounce) subdomain

dig +short MX send.swingbyy.com
  10 feedback-smtp.us-east-1.amazonses.com.            # SES bounce/complaint feedback
```

**From address the app actually uses:** `SwingBy <hello@swingbyy.com>`
(`backend/app/services/email.py` → `RESEND_FROM_EMAIL`, root domain).

### Alignment analysis — the important part

DMARC passes if **either** SPF **or** DKIM passes *and is aligned* to the From
domain (`swingbyy.com`).

- **DKIM: aligned and passing.** Resend signs with `d=swingbyy.com` (selector
  `resend._domainkey.swingbyy.com`, published on the root). `d=` == From domain
  → **relaxed + strict DKIM alignment both pass.** This alone satisfies DMARC.
- **SPF: aligned via the bounce subdomain.** Resend's return-path (envelope
  MAIL FROM) is on `send.swingbyy.com`, which publishes the SES SPF include.
  `send.swingbyy.com` is a subdomain of `swingbyy.com` → **relaxed SPF alignment
  passes.**

**Conclusion:** correctly-configured Resend mail is *already* DMARC-aligned via
DKIM. The current `p=none` is therefore **not** what sends demo mail to spam by
policy — Gmail/Yahoo's 2024 bulk-sender rules are satisfied by "SPF+DKIM pass and
a DMARC record exists with at least p=none", which is already true. Spam-foldering
(if any) is a reputation/warmup issue, not a DMARC-policy issue.

---

## 2. The one real gap, and why we do NOT jump to p=reject

The current DMARC record has **no `rua`** (aggregate-report address), so nobody
can see whether every sending path is actually aligned before tightening policy.

Going straight to `p=reject` (or `quarantine`) *before* confirming alignment from
report data is the dangerous move: if any legitimate path is unaligned, reject
**silently deletes** that mail — strictly worse than spam-foldering, and it would
happen during the demo window. So the sequence is: **turn on reporting first,
read a week of reports, then tighten.**

Do **not** "fix" SPF by adding `include:amazonses.com` to the **root** SPF record.
The root SPF is Cloudflare Email Routing's and must stay as-is for inbound mail;
Resend's SPF correctly lives on `send.swingbyy.com`. Touching the root SPF risks
breaking both inbound routing and the existing relaxed SPF alignment.

---

## 3. Copy-paste DNS changes (registrar-agnostic)

All records go in the Cloudflare DNS panel for `swingbyy.com`. **TXT** type,
**DNS only** (grey cloud — never proxy TXT/MX). TTL Auto is fine.

### STEP 1 — DO NOW (before the demo): turn on DMARC reporting, keep p=none

Replace the existing `_dmarc` TXT record.

| Field | Value |
|---|---|
| Type | `TXT` |
| Name / Host | `_dmarc` (i.e. `_dmarc.swingbyy.com`) |
| Value | `v=DMARC1; p=none; rua=mailto:dmarc-reports@swingbyy.com; ruf=mailto:dmarc-reports@swingbyy.com; fo=1; adkim=r; aspf=r; pct=100` |

Then add a **Cloudflare Email Routing** rule forwarding
`dmarc-reports@swingbyy.com` → your real inbox (e.g. `4alkubati@gmail.com`).
(Reports must be addressed to a mailbox *on the domain*; forwarding to Gmail
directly in the `rua` will not work because Gmail won't publish the required
cross-domain authorization record.)

This is **100% safe for demo mail** — `p=none` never blocks or quarantines
anything. It only starts collecting XML reports so you can see every sending
source and its pass/fail.

### STEP 2 — AFTER the demo, once ~1–2 weeks of reports show all legit mail aligned

Move to quarantine, ramped:

`v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc-reports@swingbyy.com; adkim=r; aspf=r`

Raise `pct` 25 → 50 → 100 over a few days while reports stay clean.

### STEP 3 — LATER, after a clean stretch at quarantine/pct=100

`v=DMARC1; p=reject; rua=mailto:dmarc-reports@swingbyy.com; adkim=r; aspf=r`

---

## 4. Pre-demo deliverability checklist (separate from DMARC policy)

Because `p=none` already meets the policy bar, these are the levers that
actually move demo mail out of spam:

- [ ] In the **Resend dashboard**, confirm `swingbyy.com` shows **Verified** and
      DKIM is green. (DNS says the DKIM key is published; confirm Resend agrees.)
- [ ] Send a test to a Gmail and a Yahoo/Outlook address; open **Show original**
      and confirm `SPF=PASS`, `DKIM=PASS`, `DMARC=PASS`.
- [ ] Send from a consistent, human From (`hello@swingbyy.com`) with a plain-text
      part and low link count for the first sends — warms reputation.
- [ ] Do the demo sends a little ahead of time, not cold at t=0.

---

## Status

- Steps 1–3 are **DNS changes only** — they require Kira's hands in Cloudflare.
  This doc gives the exact values; nothing here was applied automatically.
- No code change is needed for email auth; the From/DKIM setup is already correct.
