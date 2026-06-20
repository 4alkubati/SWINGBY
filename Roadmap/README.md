# SwingBy Roadmap — now → Aug 31, 2026

> The single plan to ship SwingBy. Three phases. One output: real people using it.
> Daily files use the morning/night format (see `_TEMPLATE-daily.md`). The morning brief automation is **gen-1**; more launch automations come as we go.

---

## 👉 Tomorrow (Jun 18) — per Kira
- **Morning:** set up Zoho (or Cloudflare+Gmail) email · upgrade the morning debrief to cover that day's morning + night plan.
- **Night:** the OS work — n8n, how agents run night/morning, the debrief templates, and review this roadmap.
- ⚠️ Mentor note: this is an *infrastructure* day, not a domino day. Fine for ONE more day — after this, the machine has to start dropping beta dominoes (D1 email → D4 booking) or it's just polished scaffolding.

---

## The North Star
**By Aug 31:** SwingBy is live and real businesses + clients are using it. A stranger can sign up, post/find a service, book, and pay (sandbox → live). Health at ~145 lean; AI fluency up. SwingBy is the output everything else serves.

## The three phases

| Phase | Window | Theme | Done when |
|---|---|---|---|
| **1 — BETA** | June (now) | Make it actually work for a handful of real testers | A real tester does a full booking on a real device, gets a real email |
| **2 — POLISH + PREP** | July | Fix what beta breaks; prep public launch (store, payments live, legal) | App store-ready, Stripe live, 0 critical bugs |
| **3 — PUBLIC LAUNCH** | August | Ship publicly + drive signups | Live on web (+ stores), real users transacting |

## The 4 dominoes (Phase 1 — happening now)
1. **Resend** — email actually sends
2. **Kill mock data** — Home/Dashboard/Chat on real APIs
3. **Installable build** — EAS → TestFlight / Play internal
4. **End-to-end run** — a tester completes a booking (sandbox payment)

See `June/` for the daily sprint. Costs/credentials/APIs: `COSTS-CREDENTIALS-APIS.md`.

## The OS vision (why this folder exists)
This is your command center. One place where:
- **Agents** (`../BOH`, `../FOH`, `../claude`) build the product.
- **Automations** (`../claude/automation/`) run your recurring jobs — gen-1 = morning brief. Future gens: beta-recruiting digest, launch-day broadcast, weekly metrics.
- **Roadmap** (this folder) holds the plan the agents and you both follow.

Goal: you run ONE thing in the morning and the system does the rest. We add one automation at a time — never all at once.

## Daily rhythm (weekdays)
- **Morning (6:10):** read brief → 50 min outreach → clear any human-only blocker (paste a key, approve copy).
- **Day job 10–6:** SwingBy off-limits.
- **Evening lock-in (7:15–9:45):** the real build — run the day's domino, supervised then autonomous.
- **Night:** launch overnight agent run; PC awake, Docker up.
- **Weekends:** big deep-work blocks for the heavy dominoes.
