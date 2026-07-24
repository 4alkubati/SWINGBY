# SwingBy — Security & Legal Compliance Register

**Created:** 2026-07-21 (project review) · **Last reconciled:** 2026-07-23 (legal lane)
**Owner:** Kira (Amr Alkubati)
**Status:** OPEN — living document

> **Why this exists.** The legal documents in `privacy-and-security/` were first
> written before a month of July schema and product changes (disputes,
> referrals, push tokens, the charge-before-service ruling, soft-delete + ghost
> mode, business address + geocoding). A legal document that describes behaviour
> the software does not perform is a misrepresentation, not just a stale file.
> This register maps each legal/security claim to the code reality on `main`.
>
> **2026-07-23 note:** the security and money PRs (#29/#30 and their stack) have
> since **merged to `main`**. Most of the 🔴 code-behaviour conflicts this
> register was created to track are now resolved *in code*, and the legal lane
> has rewritten the documents to match. What remains is mostly owner/counsel
> input (section D) and the publish gap (section H).

Legend: 🔴 legal-risk conflict (published claim ≠ actual behaviour) · 🟠 disclosure gap · 🟡 stale/incomplete · ✅ verified accurate against `main` · ⏸️ deferred by owner decision

---

## A. Money terms vs. code — ✅ reconciled 2026-07-23

`backend/app/services/escrow.py` + `bookings.py` + `interests.py` on `main`
implement charge-before-service with a single escrow release on completion, and
the cancellation ladder below. The canonical Terms of Service §7–§8 now matches.

| # | Item | State |
|---|---|---|
| A1 | Charge timing — pay-upfront (post: at posting; browse: at acceptance) | ✅ ToS §7.1/§7.3 rewritten to match |
| A2 | Escrow release — full amount less 10% fee on completion, nothing before | ✅ ToS §7.1; matches `escrow.compute_completion_release` |
| A3 | Client-cancel ladder — 100% / 75% / 50% refund at no-date-or->48h / ≤48h / no-show | ✅ ToS §8.1; matches `escrow.compute_cancellation_split` |
| A4 | Business-cancel — client 100% refund; late/no-show adds goodwill credit; penalty is an audit figure only | ✅ ToS §8.2 + §7.5 credits clause; matches code (credits.grant_credit) |
| A5 | Flat 10% platform fee | ✅ consistent |
| A6 | Off-platform payments — no escrow, no fee, no SwingBy refund | ✅ ToS §7.4 added; matches `payments_offplatform.py` |

> Residual: refunds only hit Stripe when a real `stripe_payment_intent_id` is
> present; in beta most bookings have none, so cancels are ledger-only. This is
> a **product/verification** matter (live-Stripe test), not a legal-text matter.
> The ToS does not over-promise instant card refunds.

---

## B. Deletion & account lifecycle — ✅ reconciled 2026-07-23

| # | Item | State |
|---|---|---|
| B1 | Deletion is a **soft delete**: `deleted_at` stamped, PII scrubbed, financial rows retained; requires password re-auth | ✅ `me.py` on `main`; Privacy §9.3 rewritten |
| B2 | In-app **ghost mode** (reversible hide-from-discovery), blocked while active booking / escrow / open dispute | ✅ `me.py`; Privacy §9.3 |
| B3 | Self-service **export** endpoint `GET /me/export` (JSON) | ✅ exists; Privacy §9.4 updated to self-service |
| B4 | CRA retention carve-out stated plainly | ✅ Privacy §7 + §9.3 |
| B5 | Suspension / soft-delete **enforced** in `deps.py` (403 / lockout) | ✅ verified on `main` |

---

## C. Data-flow disclosure — mostly reconciled

| # | Flow | State |
|---|---|---|
| C1 | Notion **CRM** signup-PII sync | ✅ **DROPPED** — `notion_crm.py` no longer exists on `main`; correctly not disclosed |
| C2 | Waitlist Worker collects name+email → Notion waitlist DB | 🟠 Notion (waitlist) now listed in Privacy §6; **confirm the pre-launch site discloses waitlist collection** (pre-launch not owned by this lane) |
| C3 | Employee roster world-readable (first/last name, avatar) | ✅ disclosed — Privacy §6 "Employee visibility" |
| C4 | Disputes, referrals, push tokens, account credits, admin audit records | ✅ added to Privacy §3 |
| C5 | Messages collected pre-booking on quote threads, not just confirmed bookings | ✅ corrected Privacy §3.1/§6 |
| C6 | **Business address + server-side Google geocoding** (new this week) | ✅ added Privacy §3.1 + Google/subprocessors; matches `businesses.py`/`geocoding.py` |
| C7 | **US API hosting (Render)** — all request PII transits the US before Canadian storage | ✅ added Privacy §6 + §12.2 (was undisclosed) |
| C8 | Pre-acceptance PII masking (first name + city-level location only) | ✅ Privacy §6 now describes it; matches `app/privacy.py` |

---

## D. Legal placeholders & owner/counsel input — 🔴 BLOCKING for publish

| # | Item | Where |
|---|---|---|
| D1 | **Legal entity name is unknown AND the repo contradicts itself** — `docs/legal/*` and `docs/press_kit.md` say "Swingbyy Inc."; `privacy-and-security/*` and the web footer said "SwingBy Technologies Inc." Canonical docs now carry `[[LEGAL_ENTITY_NAME — Kira to supply]]`. | Privacy §1 + footer; ToS §1, §10, §17, footer; `dpa-template.md`; `docs/press_kit.md`; `web/launch` Footer (now shows "SwingBy" only) |
| D2 | **Registered/incorporated mailing address** unknown | Privacy §1 + footer; ToS §17 → `[[REGISTERED_ADDRESS — Kira to supply]]` |
| D3 | **Incorporation status** unconfirmed (incorporated? sole prop? not yet?) | ToS §1 → `[[INCORPORATION_STATUS — Kira to supply]]` |
| D4 | US-subprocessor transfer adequacy (SCCs post-Privacy-Shield) unconfirmed | Privacy §12.2 |
| D5 | Whole set needs a **Canadian lawyer's** pass before public reliance — esp. arbitration clause + class-action waiver (ToS §14) and liability cap under Alberta CPA | all public docs |
| D6 | Retention period — **resolved to 6 years** (CRA: 6 yrs from end of tax year). All docs now consistent; was 7 in four files. Counsel to confirm the 6-yr reading. | ✅ aligned; counsel confirm |
| D7 | Two privacy policies / two ToS — **resolved**: `privacy-and-security/` is canonical; `docs/legal/` are now pointers. | ✅ done |
| D8 | **Quebec Law 25** — not treated as governing (SwingBy is Calgary-only). Re-assess before accepting any user located in Quebec; Law 25 attaches to data subjects *in* Quebec regardless of business location. | Privacy §12.1 |
| D9 | Minimum age unified to **18** (Privacy said 16, ToS said 18). | ✅ aligned to 18 |

---

## E. Security posture

| # | Item | State |
|---|---|---|
| E1 | `audit_log` wired for privileged actions | ✅ `record_audit` used in admin.py/disputes.py on `main` |
| E2 | **Supabase leaked-password protection (HaveIBeenPwned) is OFF** | ⏸️ **DOCUMENTED ACCEPTED RISK** — see below |
| E3 | RLS enabled on all tables with policies | ✅ (policy *bodies* not yet diffed against `pg_policies` — future drift source) |
| E4 | Stripe PCI scope = SAQ-A (Stripe Checkout) | 🟡 document in `security-overview.md` before launch |
| E5 | `is_suspended` / `deleted_at` enforced in `deps.py` | ✅ verified on `main` |
| E6 | Pre-launch API key rotation | ⏸️ deferred by owner 2026-07-20 until pre-beta API sweep |
| E7 | Password-complexity gap on non-signup paths | 🟠 see below |

### E2 — Supabase leaked-password protection: ACCEPTED RISK (decision 2026-07-23)

**Decision (Kira, 2026-07-23):** SwingBy runs on the Supabase **free plan**.
Leaked-password protection — Supabase's check of new passwords against the
HaveIBeenPwned breach corpus — is a **Pro-plan-only** feature and is therefore
**not available and is intentionally not enabled**. This is a *documented,
dated, accepted risk*, not an oversight. It will be re-evaluated when SwingBy
moves to a paid Supabase plan (revisit trigger: paid-plan upgrade, or beta
launch, whichever comes first).

**Compensating controls in force on the free plan:**

| Control | What it actually enforces (verified in code on `main`) |
|---|---|
| API-layer signup validation | `backend/app/api/auth.py` `SignupRequest.validate_password_complexity`: **min 8 chars, ≥1 lowercase, ≥1 uppercase, ≥1 digit**. No special-character requirement. |
| Client-side signup validation | `mobile/src/screens/auth/SignupScreen.js`: same rule (length ≥ 8, uppercase, lowercase, digit) with inline errors. The web launch signup should mirror this — verify. |
| Supabase Auth password policy | Set the Supabase dashboard **Auth → Password** minimum length and character-class requirements to match the API rule, so paths that go through Supabase directly (see E7) are still covered. **Confirm this dashboard setting — not visible from the repo.** |

**Known gaps in the compensating controls (E7):**
- **Password reset does not re-run the API validator.** `forgot-password` sends a
  Supabase reset email and the new password is set via Supabase directly
  (`ResetPassword` page), so only Supabase's *own* password policy applies there
  — which is why the Supabase dashboard setting above matters.
- **Employee creation** (`EmployeeCreate` in `employees.py`) enforces only
  `min_length=8` with **no character-class validator**, unlike signup. An
  owner-created employee password can be 8 lowercase letters.
- No control anywhere blocks a *known-breached* password (that is exactly what
  the Pro feature would add). Users can still choose `Password1`.

---

## F. Prioritized action list (2026-07-23)

**Blocking public reliance on the docs:**
1. Supply legal entity name, incorporation status, and registered address (D1–D3). Nothing should be published to real users until these replace the `[[...]]` placeholders.
2. Canadian lawyer pass, focused on the arbitration/class-action clauses and the liability cap (D5).

**Publish gap (live exposure) — see section H:**
3. Get the *current* legal text publicly reachable at `swingbyy.com/privacy`, `/terms`, `/cookies`. Today the live site serves stale (May 2025) copies with no link from the landing page.

**Should fix:**
4. Close the password-complexity gaps in E7 (reset path + employee creation) and set the Supabase dashboard password policy.
5. Confirm the pre-launch waitlist disclosure (C2); document PCI SAQ-A (E4).

**Deferred:** E2 (accepted risk), E6 (key rotation).

---

## G. PR reconciliation (2026-07-23)

| PR | Branch | Verdict |
|---|---|---|
| **#27** | `docs/reality-sync-2026-07-21` | **Salvage / likely already overtaken.** Docs-only + comment-only resync of `docs/API.md`, `docs/swingby_database_schema.md`, `docs/FLOW_GRAPH.md`, `tools/flow_graph.py`, `docs/MIGRATIONS.md`. `main` has since moved (business address + geocoding columns, session refresh, demo seed). The regenerated schema/API snapshots predate those, so they are **stale again** — the *method* (regenerate from live introspection) is right but the captured output must be re-run against today's `main` before merge. The `tools/flow_graph.py` per-navigator bug-fix is still valid and worth keeping. Recommend: rebase, re-regenerate, drop anything now equal to `main`. Outside this lane's file ownership — flagged for the docs/backend owner. |
| **#28** | `docs/security-legal-register` | **Superseded by this file.** #28 introduced `COMPLIANCE-REGISTER.md` plus legal edits to `privacy-policy.md`/`terms-of-service.md` and an `invoices.py` phantom-column fix. The `invoices.py` fix and the privacy/ToS edits have effectively landed via the merged security/money work on `main`; this register is the updated, reconciled version of #28's document. Recommend: **close #28** in favour of this lane's PR (which carries the register forward and finishes the reconciliation). The register's original owner-decision log is preserved in git history on that branch. |

---

## H. Publish state of every legal surface — 🔴 the live exposure

The canonical Markdown is now correct, but **users never see Markdown**. Here is
where each rendered surface actually stands:

| Surface | Serves | State | Action |
|---|---|---|---|
| `privacy-and-security/*.md` | canonical source | ✅ current (2026-07-23) | — |
| `docs/legal/*.md` | pointers | ✅ current | — |
| `mobile/src/screens/profile/PrivacyPolicyScreen.js` | in-app privacy summary | ✅ updated 2026-07-23 (soft-delete + 6-yr retention + PIPEDA/PIPA) | ships with next mobile build |
| `mobile/src/screens/shared/TermsOfServiceScreen.js` | in-app terms summary | ✅ already matched the shipped cancellation ladder | — |
| `web/launch/src/pages/{Privacy,Terms,Cookies}Page.jsx` | intended `swingbyy.com/*` | ✅ updated 2026-07-23, un-`noindex`ed, kept reachable in maintenance mode | **not currently deployed** |
| `web/pre-launch/src/pages/{Privacy,Terms}Page.jsx` | **what swingbyy.com serves today** | 🔴 **STALE — dated "May 2025", thin, no `/cookies` route in the live build, and no link from the coming-soon landing page** | **owner action — see below** |

### H1 — the exact publish problem

`swingbyy.com` currently serves an **old build of `web/pre-launch/`**: the root
is the Coming-Soon page; `/privacy` and `/terms` *do* resolve (HTTP 200) but
render the May-2025 stub text, and `/cookies` 404s in that build. The
Coming-Soon page has **no footer link** to any legal page, so they are
effectively undiscoverable. That is the live legal exposure — outdated published
terms plus unreachable-in-practice policy pages.

`web/pre-launch/` is **not owned by this legal lane**, so this lane did not edit
it. Two clean ways to fix it (Kira/owner to choose one — **do not deploy without
Kira**):

**Option 1 (smallest, keeps Coming-Soon exactly as is):** in `web/pre-launch/`,
sync the two legal page components from the canonical text, add the missing
`/cookies` route, and add three footer links (Privacy / Terms / Cookies) to
`ComingSoon.jsx`. Then redeploy the pre-launch Cloudflare Pages project. This
keeps the marketing coming-soon page intact and simply makes the current legal
text reachable. Cost: **free** (content redeploy, no plan change).

**Option 2 (uses this lane's already-updated pages):** point the
`swingbyy.com/privacy`, `/terms`, `/cookies` paths at the built `web/launch/`
legal routes. This lane has already made those pages accurate, indexable, and
reachable even under `VITE_MAINTENANCE_MODE=true` (App.jsx now exempts the legal
routes from the maintenance gate). Deploying `web/launch` with maintenance mode
ON would show the Maintenance page at `/` (so it would *replace* the pre-launch
coming-soon marketing page — only choose this if that trade is acceptable).

**Recommendation:** Option 1 for Saturday's demo — it is the minimum change that
removes the exposure while leaving the coming-soon marketing page untouched.
Exact step for Kira is in `~/brain/inbox/LEGAL-report.md`.
