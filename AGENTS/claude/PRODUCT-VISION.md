# PRODUCT VISION — SwingBy (read your slice, ignore the rest)

> The single source the loop reads first. Compacted on purpose. Each agent reads the COMMON section + its own ROLE slice — nothing else. Don't read marketing docs to write code.

## COMMON (everyone reads this)
**What:** SwingBy is a dual-sided local-services marketplace (Calgary first) — Uber × Thumbtack × Facebook Marketplace. Two roles: **Business** (provider) and **Client**. Two discovery flows: geo-browse + post-and-match.
**Why (the soul):** protect tradespeople from haggling and give clients **trust + proof** that work happened. Trust is the product.
**Build order (do NOT reorder):** backend (done ~90%) → transactions (escrow/full, **sandbox** for beta) → real data on mobile → client↔business end-to-end testing → trust layer (Live Job Status) → beta.
**Definition of DONE (whole app, beta):** a real tester installs the app, signs up, gets a branded email, posts/finds a job, books, sees **Live Job Status**, completes it, leaves a review — on a real device, payment in sandbox.
**Hard rules:** payment = sandbox until post-beta. Secrets never in chat/commits. Don't hold funds yourself (use a licensed processor later). No IoT/smart-locks (v3).

## ROLE: backend-agent
Own `backend/app/`. FastAPI + Supabase. Build: transactions (escrow + full, sandbox), the Live Job Status endpoints (arrive/start/complete + push), before/after photo endpoints, keep auth/email honest. Every route auth-guarded, Pydantic-validated, errors handled, no secret leaks. Done-rule = endpoint works + returns correct shape + a test/curl proves it.

## ROLE: mobile-agent
Own `mobile/`. Expo + React Native. Kill mock data (real APIs on Home/Dashboard/Chat). Build the **Live Job Status** timeline (provider taps Arrived/Start/Complete → client push + timeline) and before/after photo capture/view. Every list/detail screen has loading/empty/error states. Done-rule = renders real data on a device, states handled.

## ROLE: design-agent
Own the look. Clean, professional, trustworthy — never "beginner." Define tokens (color/type/spacing), component states, the Live Job Status timeline UI, before/after viewer. Hand exact specs (hex/px) to mobile. The feel: calm, premium, local. (Claude Design lives here.) Done-rule = implementable spec, WCAG AA.

## ROLE: database/security/qa
Schema + RLS + migrations (Supabase MCP). Cascade FKs, RLS on every table, advisors clean. QA runs the end-to-end flow and files breakage. Done-rule = migration verified / 0 critical advisors / flow passes.

## ROLE: FOH (marketing/pr/assistant) — only if a FOH task
The pitch: trust-first local marketplace. Differentiators vs Jobber: escrow safety + Live Job Status proof-of-work + lower take. Don't touch code. Draft only; never auto-send.

## The differentiators (the moat — keep these true)
1. **Live Job Status** — real-time "provider arrived / working / done" timeline + notifications. The trust feature.
2. **Before/after photos** — proof of work, dispute defense.
3. **Escrow option** (later, via processor) — deposit safe until done; auto-release on Live Job Status completion.


---
*[[MAP]] · read first by [[LOOP]] + [[ORCHESTRATOR]] (role slice only)*
