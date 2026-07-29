---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market, funnel, automation]
---
# 16 — Funnel Map

> How social media actually feeds SwingBy, drawn as two funnels instead of one. Built 2026-07-28 from the marketing folder as it stands.

Related: [11c-customer-acquisition.md](11c-customer-acquisition.md) · [08-kpis-and-metrics.md](08-kpis-and-metrics.md) · [14-automation-stack.md](14-automation-stack.md) · [15-tips-and-workarounds.md](15-tips-and-workarounds.md)

---

## Why two funnels

The two sides of the marketplace are won by opposite tactics, so a single funnel diagram would lie about both.

| | Supply — businesses | Demand — clients |
|---|---|---|
| Won by | Direct outreach. Phone, DM, in person. | Content, local SEO, referral, paid |
| Social's role | **Credibility check only.** A business owner Googles "is SwingBy legit" and finds something real. A 10-post bar, not a 1,000-follower bar. | The actual acquisition channel |
| Automatable? | **No.** See [15-tips-and-workarounds.md](15-tips-and-workarounds.md) — 250 owners in one city who talk to each other. One automated blast burns the market. | Yes, nearly end to end |
| First 50 | 50 conversations | Comes free once supply exists |

Per [15](15-tips-and-workarounds.md): *the first 250 businesses will not come from Instagram.*

---

## The map

```mermaid
graph TD
    subgraph SUPPLY["SUPPLY — manual, founder hours"]
        S1["Google Maps list · 250 businesses"]
        S2["Warm-up: follow + genuine comment"]
        S3["DM or call · calls convert 3x"]
        S4["Signup · 15% of cold leads"]
        S5["Profile complete · 70%"]
        S6["First quote sent · 60% in 7d"]
        S7["FIRST BOOKING · 50% in 30d"]
        S8["Activated · 4 bookings in 90d · 60%"]
        S9["Refers another business"]
        S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> S9
        S9 -.->|"compounding · zero marginal cost"| S1
    end

    subgraph DEMAND["DEMAND — automatable"]
        D1["Google Business Profile · hyperlocal SEO · FB groups · IG/TikTok · referral links"]
        D2["Profile visit"]
        D3["Click to swingbyy.com"]
        D4["Signup · 8% of visitors"]
        D5["Posts a job · 50% in 7d"]
        D6{"1 or more bids within 24h · target 90%"}
        D7["Accepts a bid · 60%"]
        D8["Pays · booking created"]
        D9["Job completed · 95%"]
        D10["Review · 70% at 5 stars"]
        D11["2nd booking 30% · referral"]
        D1 --> D2 --> D3 --> D4 --> D5 --> D6
        D6 -->|yes| D7 --> D8 --> D9 --> D10 --> D11
        D6 -->|no| DEAD["Client never returns"]
    end

    S8 ==>|"supply density is the gate"| D6
    D9 ==>|"every completed job = 3 content assets:<br/>before/after · business quote · client quote"| LOOP["Content flywheel"]
    LOOP --> D1
    LOOP -.->|"credibility surface"| S2

    style D6 fill:#f9a825,stroke:#333,color:#000
    style DEAD fill:#c62828,stroke:#333,color:#fff
    style LOOP fill:#2e7d32,stroke:#333,color:#fff
```

---

## The chokepoint

**`Posts a job → at least 1 bid within 24h`.** Target is 90% ([08](08-kpis-and-metrics.md)).

A client who posts and gets zero bids never comes back, and social media cannot fix that — only supply density can. Every hour of demand-side content spent before that gate is clear burns the top of the funnel it was meant to fill.

Practical rule from [15](15-tips-and-workarounds.md): **never drive client demand into a category with fewer than ~5 active businesses.** Launch categories one at a time.

---

## Instrumentation

Six numbers, one daily row in a Supabase `funnel_daily` table, one card pushed to Telegram. That is the whole funnel product — no SaaS ([14](14-automation-stack.md)).

| Stage | Instrument | Source |
|---|---|---|
| Reach | Impressions | Nightly engagement pull → Supabase |
| Click | Bio-link + ad clicks | Cloudflare Web Analytics — free, no cookie banner |
| Signup | Account created | Supabase `users` |
| Activate | Job posted / business profile complete | Supabase `service_posts`, `businesses` |
| Transact | First booking paid | Supabase `bookings` |
| Repeat | Second booking | Supabase `bookings` |

---

## Automation overlay

```mermaid
graph LR
    subgraph AUTO["FULLY AUTOMATED — no human in the loop"]
        A1["Scheduled publishing to IG/FB/X/LI/TikTok"]
        A2["1 brief to 5 platform captions · Claude"]
        A3["Templated graphics · HTML to PNG · $0"]
        A4["Nightly engagement pull"]
        A5["Daily 6-number funnel card"]
        A6["Email drips · Resend"]
        A7["Post-completion review request"]
        A8["FAQ DM replies · 5 categories only"]
    end

    subgraph DRAFT["DRAFTED — you approve, ~30s each"]
        B1["All other DMs"]
        B2["Comment replies"]
        B3["Outreach personalisation · bot drafts, YOU send"]
        B4["Business spotlight posts · needs consent"]
    end

    subgraph NEVER["NEVER AUTOMATE — load-bearing"]
        C1["Sending supply-side outreach"]
        C2["Neighbourhood Facebook group posts"]
        C3["Disputes · payments · no-shows · safety"]
        C4["Any price quote or timeline commitment"]
    end

    AUTO --> FREED["Hours freed → founder outreach + calls"]
    DRAFT --> FREED

    style AUTO fill:#2e7d32,stroke:#333,color:#fff
    style DRAFT fill:#f9a825,stroke:#333,color:#000
    style NEVER fill:#c62828,stroke:#333,color:#fff
    style FREED fill:#1565c0,stroke:#333,color:#fff
```

The five auto-send DM categories, and nothing else: how it works · is it free for clients · what areas we cover · how to sign up as a business · where's the app. Everything else escalates unread. Guardrails in [14](14-automation-stack.md).

---

## Time budget

The point of the machine is to move hours from content ops to outreach.

| | Today, as written | After automation |
|---|---|---|
| Content production | ~6 h/wk ([07](07-content-calendar.md)) | ~0 — 240 posts already drafted in `content-library/` |
| Publishing + scheduling | manual | 0 — n8n cron |
| DM + comment replies | 2h SLA across 5 platforms | ~1.5 h/wk of approvals |
| **Left for outreach** | little | **the evening** |

Caveat: [12-social-media-playbook.md](12-social-media-playbook.md) commits to 17 posts/week across 7 platforms while its own principle #2 says one platform at a time. At launch, run **Instagram + Facebook + Google Business Profile** only. Adding platforms adds approval load, not customers.

---

## Build order

From [14-automation-stack.md](14-automation-stack.md), with one change.

| Phase | Build | Gate |
|---|---|---|
| **0** | Accounts + mailboxes ([13](13-accounts-and-identity.md)). ~2 h of clicking. Start Meta App Review the same day — it takes days. | **Do now** — handles get squatted |
| **1** | Import the 3 workflow JSONs; swap Slack→Telegram/Discord and OpenAI→Claude; approval gate on, auto-post **off** | After M1 |
| **1b** | `funnel_daily` table + the six-number daily card | **Moved forward** — without it you run content blind to which stage leaks |
| **2** | Templated image renderer, HTML→PNG | With phase 1 |
| **3** | DM triage, escalate-everything mode | After Meta App Review starts |
| **4** | Auto-send for the 5 safe FAQ categories | After 2 weeks of clean phase-3 logs |

Phase 0 is the only piece worth doing before the product can take a payment. Everything from phase 1 on distributes content about a product a stranger still can't sign up for and pay — the M1 gate and the walkthrough audit come first.

---

## Open items this map surfaced

1. **Google Business Profile is under-weighted.** Free, highest-intent local surface, feeds the 50-page SEO campaign — and it's missing from the channel tables in [06](06-growth-playbook.md) and [12](12-social-media-playbook.md). For a Calgary marketplace it likely beats Instagram reach outright.
2. **No analytics below the click.** Cloudflare Web Analytics isn't installed, so `Click → Signup` is currently unmeasurable.
3. **Model access for n8n.** The AI nodes need an Anthropic **API key** — a Pro subscription can't authenticate them. The subscription route is shelling out to Claude Code headless from an Execute Command node. Decision pending; see the note in [14](14-automation-stack.md).
