# SwingBy — Security & Legal Compliance Register

**Created:** 2026-07-21 (project review)
**Owner:** Amr Alkubati
**Status:** OPEN — working document, driven down interactively

> **Why this exists.** All 12 legal documents in `privacy-and-security/` were last written **2026-06-20**, a month before the July schema changes, the disputes/referrals/push-token features, the payment rulings, and the deletion model. They have drifted from what the code and database actually do — the same drift that produced three production outages on the technical-docs side. This register maps every legal/security claim to the code reality, flags the conflicts, and tracks the fix. **A legal document that describes behaviour the software does not perform is a misrepresentation, not just a stale file** — so the money and privacy conflicts below are the top priority.

Legend: 🔴 legal-risk conflict (published claim ≠ actual behaviour) · 🟠 disclosure gap · 🟡 stale/incomplete · ✅ verified accurate · ⏸️ deferred by owner decision

---

## A. Money terms vs. code vs. ruling — 🔴 HIGHEST RISK

The Terms of Service publishes a payment/escrow/cancellation contract to users. It matches neither the shipped code nor the 2026-07-21 ruling. All three must be reconciled to ONE model before beta.

| # | ToS says (published to users) | Code actually does | 2026-07-21 ruling | Action |
|---|---|---|---|---|
| A1 | §7.3: client "not charged until the booking is confirmed by both parties" | Never charges — Stripe webhook is dead (`payments_stripe.py` phantom `notes` col); 0 of 18 payments have a `stripe_payment_intent_id` | **Charge BEFORE service.** Flow 1 (post-and-match): charge right before posting. Flow 2 (browse): charge at Accept in chat. | Rewrite ToS §7.3 to the charge-up-front model. Money agent (dispatched) builds the code. **ToS and code must ship reconciled.** |
| A2 | §7.1: 50% released to business "when the booking is confirmed", remaining 50% −10% on completion | Releases 50% at quote-**acceptance**, before any charge, with money never collected | Escrow holds the up-front charge; release schedule TBD against the new charge timing | Decide the release schedule under charge-up-front, then align ToS §7.1 + `interests.py`/`bookings.py` |
| A3 | §8.1 client cancel: 100% / 75% / 50% **refund** ladder (>48h / ≤48h / no-show) | Computes 25% (>48h) / 50% (≤48h) **penalty**, then **discards it** — no ledger movement, no Stripe refund | (not yet ruled) | **Pick one penalty schedule.** Reconcile ToS §8.1, `bookings.py` cancel math, and actual refund execution. Needs your decision on the numbers. |
| A4 | §8.2 business cancel promises client "100% refund + **credit**" | No credit system exists (`referrals.credit_cents` is always 0) | (not yet ruled) | Either build credits or remove the promise from ToS §8.2. Business-side cancel flow also missing in mobile (money agent scoped). |
| A5 | §7.2: flat 10% platform fee | 10% math is arithmetically correct where it runs | — | ✅ fee % is consistent; only the *timing* (A1/A2) is wrong |

**Decision needed from you:** the cancellation penalty numbers (A3). Everything else follows from the charge-before-service ruling already given.

---

## B. Deletion & account lifecycle — 🔴

| # | Doc says | Reality / ruling | Action |
|---|---|---|---|
| B1 | Privacy §9.3: "delete your data within 30 days"; "Deleting your account removes your profile from public view immediately" | `DELETE /me` is broken AND destructive (deletes businesses, then 400s on a missing FK). Ruling: **true delete = website only, requires password**; **in-app = ghost mode**, not deletion. | Security agent (dispatched) rebuilds deletion as soft-delete + PII scrub + ghost mode. Then rewrite Privacy §9.3 to describe: website hard-request vs in-app ghost, and the CRA 6-year retention carve-out. |
| B2 | Privacy §7: "Account data: until deletion, then 30 days backup purge" | Soft-delete keeps the row (scrubbed) for financial-record retention — contradicts "30 days" | Update Privacy §7 retention table to match soft-delete reality |
| B3 | Privacy §9.4 portability: "request an export" by email | A self-service `GET /me/export` endpoint exists (undocumented, unverified) | Verify the endpoint works; update Privacy §9.4 to mention self-service export |
| B4 | (not documented) | CRA requires 6-year retention of financial records → a true "delete everything" is legally impossible | State the retention carve-out plainly in Privacy §7 + §9.3 |

---

## C. Undisclosed data flows — 🟠 PIPEDA disclosure gaps

| # | Flow | Status | Action |
|---|---|---|---|
| C1 | **Notion CRM sync** — `backend/app/services/notion_crm.py` POSTs new-signup PII (name/email/role) to a Notion leads database (a US third party) | **NOT disclosed** in `subprocessors.md` or Privacy §6 | Add Notion to subprocessors + privacy policy, or gate the sync behind consent, or drop it. Owner decision. |
| C2 | **Waitlist Worker** — `api.swingbyy.com/waitlist` collects emails via Cloudflare Worker | Check whether pre-launch privacy covers it | Confirm disclosure; add if missing |
| C3 | **Employee roster is world-readable** — `GET /employees/business/{id}` returns staff first/last name, avatar, and `user_id` to ANY authenticated user, including deactivated staff | In-code marked "intentional (trust card)" but not disclosed as a privacy design | Either restrict, or disclose in Privacy §6 that staff names are publicly visible. Owner decision. |
| C4 | New data categories not listed in Privacy §3: **disputes** (issue text, resolution notes), **referrals** (codes, referee links), **push tokens** | 🟡 stale | Add to Privacy §3 collection inventory |
| C5 | Privacy §3.1 + §6: messages collected "on confirmed bookings" only | Messages are collected on **quote/interest threads before booking** too (per CLAUDE.md unified threads) | Correct Privacy §3.1/§6 to reflect pre-booking chat |

---

## D. Legal placeholders already flagged in the docs — 🟡 need you / counsel

| # | Item | Location |
|---|---|---|
| D1 | Legal entity name unconfirmed ("[SwingBy Technologies Inc. / Amr Alkubati]") — pending incorporation | Privacy §1, ToS, footer |
| D2 | Physical/incorporated mailing address is a TODO | Privacy §1 |
| D3 | US-subprocessor transfer adequacy (SCCs post-Privacy-Shield) unconfirmed | Privacy §12 |
| D4 | Whole set needs a lawyer's pass before public reliance | all 12 docs |
| D5 | Effective/Last-updated dates will need bumping on republish | Privacy, ToS headers |
| D6 | **Retention period inconsistency: 6 vs 7 years.** CRA statute is 6 years from end of tax year (~7 years from transaction in practice). `privacy-policy.md` + register now say 6; `data-handling.md`, `pipeda-compliance.md`, `dpa-template.md`, `docs/legal/PRIVACY_POLICY.md` say 7. Counsel must set ONE number, then align all docs. | multiple |
| D7 | **Two privacy policies exist** — `privacy-and-security/privacy-policy.md` (updated 2026-07-21) and `docs/legal/PRIVACY_POLICY.md` (stale). Duplicate canonical docs will drift. Pick one home, redirect/delete the other. | privacy docs |

---

## E. Security posture — code & platform

| # | Item | Status | Action |
|---|---|---|---|
| E1 | **`audit_log` table is completely unwired** — exists, 0 rows, 0 code refs; every admin action (suspend, force-complete, dispute-resolve) leaves no accountability record | 🔴 for dispute defensibility | Security agent (dispatched) wires it up |
| E2 | **Supabase leaked-password protection is DISABLED** (confirmed via security advisors) | 🟠 one toggle | Enable in Supabase Auth settings — free win, no code |
| E3 | RLS: `rls_policies.sql` predates audit_log/push_tokens/disputes/referrals | 🟡 doc stale only | Live RLS verified: all 16 tables enabled, all have policies — **actual posture is fine**; regenerate the doc. Policy *bodies* not yet diffed against `pg_policies` (next drift source). |
| E4 | Stripe PCI scope | 🟡 undocumented | You're on Stripe Checkout → SAQ-A. Document it in `security-overview.md` before launch. |
| E5 | `is_suspended` / `deleted_at` never enforced in `deps.py` — suspension is cosmetic | 🔴 | Security agent (dispatched) enforces both |
| E6 | Pre-launch API key rotation | ⏸️ | Deferred by owner 2026-07-20 until the pre-beta API sweep — not re-raising |
| E7 | `security-checklist.md` / `security-overview.md` / `incident-response.md` accuracy pass | 🟡 | Re-verify against current infra once E1–E5 land |

---

## F. Prioritized action list

**Blocking beta (legal exposure):**
1. Reconcile the money model — ToS §7–§8 ↔ code ↔ ruling (A1–A4). *Needs your cancellation-penalty decision (A3).*
2. Rewrite deletion sections once the security agent lands soft-delete + ghost mode (B1–B4).
3. Disclose or remove the Notion CRM PII sync (C1).

**Should fix before beta:**
4. Enable Supabase leaked-password protection (E2) — 2 minutes.
5. Correct the Privacy data inventory: pre-booking messages, disputes, referrals, push tokens (C4–C5).
6. Decide the employee-roster visibility posture and disclose/restrict (C3).

**Housekeeping:**
7. Confirm waitlist disclosure (C2); document PCI SAQ-A (E4); regenerate RLS doc (E3); re-verify the security docs after code lands (E7).
8. Legal placeholders (D1–D5) — gated on incorporation + counsel.

---

## G. Related work — 2026-07-21 review (all 5 PRs open as drafts)

| PR | Scope | Register items it addresses (code side) |
|---|---|---|
| **#26** | mobile dead-nav + de-faked stub features | (mobile only) |
| **#27** | technical docs regenerated from live DB (API, schema, flow graph, new `docs/MIGRATIONS.md`) | E3 (RLS doc), technical-doc drift |
| **#28** | this compliance register | — |
| **#29** | security/account-lifecycle: suspension + soft-delete enforcement in `deps.py`, `DELETE /me` password re-auth + PII-scrub, ghost mode (`users.is_ghosted` applied), audit_log wired | **B1–B4, E1, E5**, C-partial |
| **#30** | money/escrow: phantom-column writes, status-literal reporting, cancellation ledger + real refund, webhook idempotency (`stripe_events` applied), charge-before-service structure | **A1–A5 (code); D-cancel math still needs the numbers decision (A3)** |

**Stacking:** #30 is stacked on #29 (merge #29 → main first, #30 auto-retargets). Combined backend HEAD verified: 105 tests pass, ruff clean.

### ⚠️ New gate before #30 merges — live-Stripe verification
The money agent correctly refused to auto-mark any payment captured without a real Stripe event. **Three money paths are built but unverified against live Stripe (test mode) and MUST be exercised before merge:** (1) capture at post/accept, (2) cancellation refund, (3) webhook idempotency replay. This is a release-blocking checklist item, not a code TODO.

### Owner decisions — RESOLVED 2026-07-21
- **A3 cancellation** → adopt the published ToS ladder (code changes to match). Requires a credit system for the business-cancel "+ credit" cases. → code in `fix/cancellation-ladder-and-credits` (dispatched, stacks on #30); ToS §8 already matched and is unchanged.
- **C1 Notion sync** → DROP it (delete `notion_crm.py`, no disclosure). → in the same dispatched branch. Register item C1 closed; no privacy disclosure added (correct).
- **C3 employee roster** → keep public, disclose. → Privacy §6 disclosure added (this branch); code hardening (drop `user_id`, hide deactivated staff) in the dispatched branch.

### Legal-document rewrites — DONE this branch (2026-07-21)
- ToS §7.1/§7.3 rewritten to the charge-upfront model; new §7.5 account-credits clause. §8 ladder verified already-correct, unchanged.
- Privacy §3 data inventory: messages corrected to pre-booking threads; added disputes, referrals, account credits, push tokens.
- Privacy §6: employee-roster public-visibility disclosure added.
- Privacy §7 retention + §9.3 deletion + §9.4 export rewritten to the soft-delete / website-hard-delete-with-password / in-app ghost-mode model + CRA carve-out. Header "Last updated" → 2026-07-21.

> Still open on the legal side: D1–D7 (entity name, address, SCCs, lawyer pass, dates, the 6-vs-7-year number, the duplicate privacy policy) and the E-series security posture items. The legal text now MATCHES the intended code behaviour, but must not be published until the code PRs merge and the live-Stripe verification gate passes — otherwise the docs describe behaviour not yet live.
