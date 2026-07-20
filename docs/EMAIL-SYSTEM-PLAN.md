# SwingBy Email System — Audit + Implementation Plan

Date: 2026-07-20
Scope: every email SwingBy sends — auth (login/verification/reset), transactional
(bookings/payments/disputes), operational (contact form), and marketing (waitlist/digests).

---

## 1. What is actually true today

Audited: `backend/app/services/email.py`, `backend/app/api/{auth,contact,bookings,interests,payments_stripe}.py`,
`web/launch/docs/email_templates/`, `web/pre-launch/docs/email_templates/`, `backend/app/config.py`.

**F1 — Email delivery is almost certainly off, and fails silently by design.**
`send_email()` no-ops when `RESEND_API_KEY` is unset (`email.py:31-34`) — it logs at `debug`
and returns. `config.py:40` still describes the key as "set after domain verified," and no
local env file sets it. **Verify this in the deploy environment before anything else** — if it
is unset there, every welcome email, booking confirmation, payment receipt and contact-form
submission is being dropped on the floor and nobody would ever notice.

**F2 — Auth emails are not ours at all.**
Signup confirmation, magic link and password reset are sent by **Supabase**, not by our code
(`auth.py:~451` calls `supabase.auth.reset_password_email`). Unless Supabase's templates and
SMTP have been overridden in the dashboard, those emails currently go out from
`noreply@mail.app.supabase.io` with Supabase's stock grey template. That is the single most
visible "looks unprofessional" gap — it is the *first* email a new user ever sees.

**F3 — We have good templates. Nothing uses them.**
10 polished, dark/light-aware, branded HTML templates exist:
- `web/pre-launch/docs/email_templates/` → `confirm_signup`, `magic_link`, `reset_password`
- `web/launch/docs/email_templates/` → `welcome_client`, `welcome_business`, `booking_confirmed`,
  `booking_confirmed_business`, `payment_released`, `review_request`, `weekly_business_digest`

They live under `docs/`. They are referenced by no code path. Meanwhile `email.py` sends raw
inline `<p>`/`<ul>` fragments with no `<html>` wrapper, no logo, no footer, no unsubscribe.
Two email systems that have never been introduced to each other.

**F4 — HTML injection into outgoing email.**
`contact.py` correctly `html.escape()`s user input. `email.py` does **not** — it f-strings
`first_name`, `business_name`, `post_title` straight into HTML. A business named
`<img src=x onerror=...>` or a post titled with markup lands unescaped in a recipient's inbox.
Real bug, not theoretical: `post_title` is free text from clients.

**F5 — One sender address, eighteen documented ones.**
Everything sends from `hello@swingbyy.com`. The repo documents 18 role addresses already
(`privacy@`, `support@`, `security@`, `legal@`, `press@`, `partnerships@`, `careers@`,
`accessibility@`, `admin@`, `team@` …). Google Workspace is provisioned; the sender identity
strategy is not.

**Also found:** three different template syntaxes in play (Go `{{ .ConfirmationURL }}` for
Supabase, Handlebars-ish `{{first_name}}` in launch templates, Python f-strings in code) with
no renderer to reconcile them; `{{unsubscribe_url}}` is referenced but nothing generates it;
no plain-text alternative on any email; no SPF/DKIM/DMARC verification recorded anywhere; and
CASL (Canadian anti-spam) is flagged in `marketing/05-launch-checklist.md:25` with nothing built.

---

## 2. Sender identity map

Decide once, encode in config, never think about it again.

| Address | Used for | Reply behaviour |
|---|---|---|
| `hello@swingbyy.com` | Welcome, onboarding, product announcements | Monitored inbox |
| `bookings@swingbyy.com` | Booking confirmed/date/complete/cancelled | Monitored inbox |
| `receipts@swingbyy.com` | Payment receipts, payouts, invoices | No-reply → auto-responder pointing to support@ |
| `security@swingbyy.com` | Login link, verification, password reset, new-device alert | No-reply → auto-responder |
| `support@swingbyy.com` | Contact form routing, dispute updates | Monitored inbox (this is the human one) |
| `news@swingbyy.com` | Waitlist, digests, marketing — **separate subdomain recommended** | No-reply |

Rule: **never send marketing from the same domain/IP reputation as auth.** If a campaign gets
spam-flagged, password reset emails must not go down with it. Send marketing from
`news.swingbyy.com` as a Resend subdomain; keep `swingbyy.com` for transactional only.

---

## 3. The plan — 26 items

Ordered. Phase 0 is what blocks a usable beta; everything below it is polish that does not.

### Phase 0 — Make email work at all (blocks beta)

1. **Verify `swingbyy.com` in Resend and set `RESEND_API_KEY`.** Until this is done every item
   below is theatre. *Human-only step — needs Resend dashboard + DNS.*
2. **Publish SPF, DKIM and DMARC records** for `swingbyy.com`. Start DMARC at `p=none` with an
   `rua=` reporting address, tighten to `p=quarantine` after two clean weeks. Without DKIM,
   Gmail bulk-filters us. *Human-only — DNS.*
3. **Point Supabase Auth at Resend SMTP** (Auth → SMTP Settings) so login/verification/reset
   emails stop coming from `mail.app.supabase.io`. Sender: `SwingBy <security@swingbyy.com>`.
   *Human-only — Supabase dashboard.*
4. **Paste the three auth templates into Supabase** (Auth → Email Templates): `confirm_signup`,
   `magic_link`, `reset_password`. They are already written and on-brand. This is copy-paste.
5. **Fix the HTML-injection bug** in `email.py` — escape every interpolated value before it
   reaches the template. One helper, applied at the render boundary.
6. **Set `CONTACT_INBOX_EMAIL=support@swingbyy.com`** so contact-form submissions reach a human
   instead of `hello@`, and confirm the Workspace inbox actually exists.

### Phase 1 — Make every email look like one company

7. **Build a real template renderer** in `backend/app/services/email_templates.py` — load the
   HTML files from a package directory, substitute escaped variables, one syntax. Kill the
   f-string fragments.
8. **Move the 7 launch templates out of `web/*/docs/`** into `backend/app/email_templates/` so
   they ship with the backend and are importable. Docs directories are where templates go to die.
9. **Extract one shared base layout** (header/logo, card, button, footer) so a brand change is
   one file, not ten. Today the same 30 lines of CSS are copy-pasted in every template.
10. **Wire the existing templates to the existing send calls** — `send_welcome_email` →
    `welcome_client.html`, and so on. Add the missing counterpart: business welcome currently
    has a template and no caller.
11. **Add a plain-text alternative to every send.** Resend accepts `text` alongside `html`.
    HTML-only is a measurable spam signal and breaks screen readers and watch notifications.
12. **Add preheaders to the three auth templates.** All 7 launch templates already have one; none
    of `confirm_signup`, `magic_link`, `reset_password` do. The preheader is the second line of
    text in every inbox preview — leaving it empty shows raw CSS. These are the three emails a
    brand-new user sees first.
13. **Fix the colour drift.** `marketing/09-brand-guidelines.md` says Primary is "TBD" while the
    templates hardcode `#6E56F7`. Resolve the token, reference it, delete "TBD".
14. **Rewrite subject lines** to a consistent scheme. Today: `"Booking cancelled — SwingBy"`,
    `"New quote on {title} — SwingBy"`, `"Payment received — SwingBy receipt"`. Pick one shape,
    front-load the useful noun, drop the trailing `— SwingBy` (the sender name already says it).
15. **Set a correct `Reply-To` per email class** per the table in §2. "Reply to this email and
    we'll take a look" appears in `send_booking_cancelled` — today that reply goes nowhere.
16. **Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers** to all non-transactional mail.
    Gmail and Yahoo require one-click unsubscribe for bulk senders; missing it is a hard
    deliverability penalty, not a nicety.
17. **Implement the unsubscribe endpoint + preference storage.** `{{unsubscribe_url}}` is already
    printed in the templates and currently resolves to nothing — a dead link in production email
    is worse than no link.

### Phase 2 — Coverage, reliability, compliance

18. **Fill the missing lifecycle emails.** Currently no email exists for: email-change
    confirmation, new-device/new-location login alert, dispute opened/resolved, employee
    invitation, subscription renewal or failure, payout sent, or booking reminder 24h before.
    Users read silence as "the product forgot about me."
19. **Add idempotency to sends.** A retried webhook or a double-clicked button sends the receipt
    twice today. Key each send on `(recipient, template, entity_id)` and skip duplicates.
20. **Log every send to a table** (`email_log`: recipient, template, status, provider message id,
    timestamp — never the body). Right now a "did the customer get their receipt?" question is
    unanswerable. This is also the audit trail privacy asks for.
21. **Handle bounces and complaints** via a Resend webhook. Hard bounce → mark address invalid
    and stop sending. Spam complaint → suppress permanently. Sending to a known-dead address
    repeatedly is how a domain reputation dies.
22. **Move sends off the request path.** `send_email` has a 5s timeout inside request handlers;
    six of those in one endpoint is a 30s worst case. Queue them, or at minimum fire them in a
    background task.
23. **CASL compliance** (this is Canada — the penalties are real). Explicit opt-in checkbox for
    marketing, double opt-in on the waitlist, sender's physical mailing address in the footer of
    every commercial email, unsubscribe honoured within 10 business days. Transactional email is
    exempt; the weekly digest and waitlist blasts are not.
24. **Add an email preview/test harness** — a dev-only route or script that renders every
    template with sample data to HTML files. Currently the only way to see an email is to
    trigger the real flow in production.
25. **Seed-inbox test before launch.** Send the full set to Gmail, Outlook, iCloud and a Yahoo
    address; confirm inbox placement, dark-mode rendering and mobile width. Apple Mail dark mode
    inverts backgrounds in ways `prefers-color-scheme` does not fully control.

### Phase 3 — Marketing email (after beta is live)

26. **Separate the marketing stack from the transactional one** — `news.swingbyy.com` subdomain,
    its own DKIM, its own suppression list, its own warm-up. Then, and only then, build the
    waitlist "we're live" sequence in `marketing/05-launch-checklist.md:77` on top of the
    `weekly_business_digest` template that already exists.

---

## 4. What only you can do

Everything else I can build. These four need your hands on a dashboard:

1. Resend account → verify `swingbyy.com`, generate API key.
2. DNS → add SPF, DKIM, DMARC records (Resend gives you the exact values).
3. Supabase → Auth → SMTP Settings → point at Resend.
4. Google Workspace → confirm `bookings@`, `receipts@`, `security@`, `support@` exist and route
   somewhere you actually read.

Items 1–4 unblock 22 of the 26 items above. They are roughly 30 minutes of clicking.

---

## 5. Honest note on sequencing

Items 1–6 are the difference between "emails don't work" and "emails work and look right."
That is a beta blocker.

Items 7–26 are quality. They matter, and none of them stop a stranger from signing up and
paying. If the choice is between shipping Phase 0 this week and designing Phase 2 this week,
ship Phase 0.
