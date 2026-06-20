# Personnel — Notion schedule rewrite + finance dashboard

You are operating autonomously with the **Notion MCP** connected. Your job is two things:
1. **Rewrite the founder's personal schedule** so every item shows as a scheduled event (with date/time + reminders) instead of plain rows.
2. **Build / fix the finance database** so entering dates auto-shows charts that answer: "What's my runway? What's my burn? Am I on budget?"

This brief is Notion-only. **Do NOT touch any code in this repo. Do NOT touch n8n. Do NOT touch Supabase.**

---

## Hard rules

1. **No code changes** anywhere in `mobile/`, `web/`, `backend/`.
2. **No `.env*` access**.
3. **No destructive Notion ops** — never delete pages, databases, or properties unless explicitly told. Adding properties + creating new views is fine. Renaming OK if old name still resolves.
4. **No moving content out of "Amr Life OS"** unless you've confirmed there's a clean parent target. If a target page is ambiguous, leave the schedule in place and ADD the event-style view to it.
5. **No secrets in any new page content**.
6. **If a database doesn't exist, create it.** Don't fail silently.
7. **Document every change** in a single summary page: `Personnel rewrite log — <date>`.

---

## Context

- Founder = Amr Alkubati
- Workspace they use: "Amr Life OS" + a separate Notion area with PROJECTS / SwingBy
- Travel constraints (must reflect in finance + schedule):
  - **Sept 2026 — Egypt / Yemen, ~1 month**
  - **Oct 2026 — SwingBy public launch**
  - **Feb 2027 — Brazil, length TBD**
- The founder uses an iPhone + Google ecosystem. Reminders must work in iOS Calendar and Google Calendar (Notion → calendar sync happens via subscription URL or iCal export).

---

## Workstream 1 — Schedule rewrite (event-style)

### 1.1 Discover what exists
Use `notion-search` for:
- "schedule"
- "schema"
- "personnel"
- "weekly routine"
- "amr routine"
- "calendar"

Then use `notion-fetch` on the top 3 most relevant results. Identify which one is the founder's actual personal schedule database. If multiple candidates exist, **list them in the rewrite log and proceed with the most-recently-updated**.

### 1.2 Audit the current schema
For the chosen schedule database, document:
- Current properties (names + types)
- Current views (names + filters)
- Sample row count
- Whether it has Date properties or just text

Write this audit to the rewrite log.

### 1.3 Convert to event-style

Add these properties if they don't exist (use `notion-update-data-source`):
- **Title** (existing)
- **Start** — Date property, with time
- **End** — Date property, with time (use Notion's Date range if cleaner)
- **All day** — Checkbox
- **Recurrence** — Select: `Once / Daily / Weekly / Biweekly / Monthly / Quarterly`
- **Reminder** — Multi-select: `5 min / 30 min / 1 hour / 1 day / 1 week`
- **Category** — Select: `SwingBy / Personal / Health / Finance / Travel / Family / Side projects`
- **Status** — Select: `Upcoming / Today / Done / Skipped`
- **Location** — Text
- **Notes** — Text

If the founder already has rough text-based schedule entries, leave them — just add the new properties (existing rows get blank for new properties; that's fine).

### 1.4 Create three new views
Use `notion-create-view`:

- **"📅 Calendar view"** — calendar layout grouped by Start
- **"🗓 This week"** — table view filtered to Start within next 7 days, sorted by Start asc
- **"🔁 Recurring"** — table view filtered to Recurrence != "Once"

### 1.5 Seed the recurring schedule (post-launch ops)
Add these recurring events if missing. Use `notion-create-pages` against the schedule data source:

| Title | Recurrence | Start (next occurrence) | Reminder | Category |
|---|---|---|---|---|
| 🏃 Personnel Run (laundry + meds + finance review) | Weekly | next Sunday 10am | 30 min | Personal |
| 📊 SwingBy weekly KPI review | Weekly | Monday 9am | 30 min | SwingBy |
| ✉️ Send 5 cold emails | Weekly | Friday 4pm | 1 hour | SwingBy |
| 🧾 Stripe payout reconciliation | Monthly | 1st of month 10am | 1 day | SwingBy |
| 💬 NPS survey send | Quarterly | first day of next quarter 9am | 1 day | SwingBy |
| 💊 Refill prescriptions | Monthly | 1st of month 11am | 1 week | Health |
| 🛫 Egypt/Yemen prep checklist | Once | 2026-09-01 09:00 | 1 week | Travel |
| ✈️ Egypt/Yemen departure | Once | 2026-09-15 (placeholder) | 1 week | Travel |
| 🇨🇦 Return from Egypt → launch sprint | Once | 2026-10-15 (placeholder) | 1 day | SwingBy |
| 🚀 SwingBy public launch | Once | 2026-10-20 (placeholder) | 1 week | SwingBy |
| 🇧🇷 Brazil departure | Once | 2027-02-01 (placeholder) | 1 month | Travel |

Mark placeholder dates with a Note: "placeholder — confirm exact date." Do not invent precise dates.

### 1.6 Calendar sync instructions
Create a sub-page inside the schedule database called **"📲 How to subscribe (iPhone + Google)"**. Content:

- iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the Notion calendar URL.
- Google Calendar: Settings → Add calendar → From URL → paste the same Notion calendar URL.
- Note: Notion exposes calendar URLs at View settings → "..." → Get iCal link.
- Leave a `> TODO (HUMAN):` callout telling them to grab the iCal URL from the new Calendar view and paste it once.

---

## Workstream 2 — Finance database with charts

### 2.1 Discover what exists
Search Notion for:
- "finance"
- "budget"
- "expenses"
- "burn"
- "runway"

Fetch the top 3 results. Identify any existing finance DB.

### 2.2 If finance DB exists — extend it. If not — create it.

Create a database called **"💰 Amr — Finance"** with two data sources:

**Source A — "Transactions"**
| Property | Type | Notes |
|---|---|---|
| Title | Title | Auto, brief description |
| Date | Date | When the transaction hit |
| Amount | Number ($) | Negative for expense, positive for income |
| Type | Select | Income / Expense / Transfer |
| Category | Select | Rent / Food / Subscriptions / Tools (OpenAI, n8n, hosting) / Travel / Personal / SwingBy / Other |
| Currency | Select | CAD / USD / EGP / BRL |
| Recurring | Checkbox | true if monthly subscription |
| Notes | Text | |
| Month | Formula | `formatDate(prop("Date"), "YYYY-MM")` — for grouping |

**Source B — "Budget plan"**
| Property | Type | Notes |
|---|---|---|
| Title | Title | e.g. "September 2026", "October 2026" |
| Month | Date | First of the month |
| Planned income | Number ($) | |
| Planned expenses | Number ($) | |
| Actual income | Rollup | Sum of positive Transactions in that month |
| Actual expenses | Rollup | Sum of negative Transactions in that month, abs value |
| Net | Formula | Actual income − Actual expenses |
| vs Plan | Formula | (Actual expenses − Planned expenses) — negative means under budget |
| Travel month? | Checkbox | true for Sept 2026 and Feb 2027 |

### 2.3 Seed budget rows
Create rows in the Budget plan source for these months (planned amounts as `> TODO (HUMAN): fill in`):
- 2026-07 (current month-ish)
- 2026-08
- 2026-09 (Egypt — travel month)
- 2026-10 (SwingBy launch)
- 2026-11
- 2026-12
- 2027-01
- 2027-02 (Brazil — travel month)
- 2027-03
- 2027-04

### 2.4 Create chart-ready views
Use `notion-create-view` to add these views on the Transactions source:

- **"📈 Monthly burn (chart)"** — Group by Month, sum Amount where Type=Expense. Render as Bar chart if Notion's chart block is available, else as table the founder can convert to a chart manually.
- **"🟢 Income vs Expense (chart)"** — Group by Month, stacked bars Income green / Expense red.
- **"🍰 Category breakdown"** — Group by Category, sum Amount. Pie chart.
- **"🔁 Recurring subscriptions"** — Filter Recurring=true, sum Amount. Table sorted by Amount desc.

If Notion's built-in chart block isn't available via the MCP, create the views as standard tables/board and leave a `> TODO (HUMAN):` to insert a Chart block manually pointing at the view's data source.

### 2.5 Build the runway dashboard page
Create a sub-page inside the finance database called **"🛟 Runway dashboard"**. Content:

- Callout block: "Runway = current cash / monthly burn". Numbers update as you log transactions.
- Inline rollup/formula displays:
  - **Current cash on hand** — placeholder, founder fills in
  - **Last 3-month avg burn** — formula or rollup if possible; else placeholder
  - **Implied runway** — `current cash / monthly burn`, formatted as months
  - **Travel-adjusted runway** — same but with Sept + Feb burn × 1.3 to account for travel costs
- Section: "Travel impact"
  - Egypt 2026 estimated cost — placeholder
  - Brazil 2027 estimated cost — placeholder
- Section: "Subscription audit" — link to the recurring subscriptions view
- Section: "Decision triggers"
  - If runway < 6 months → pause non-essential subscriptions
  - If runway < 3 months → talk to family / look at side income
  - If runway < 2 months → SwingBy revenue is your only option, focus there

### 2.6 Subscription import helper
Add a callout in the runway dashboard: "Common subscriptions to log if not already": Spotify, iCloud, GitHub, OpenAI, Anthropic, n8n cloud, Render, Cloudflare, Notion, Resend (when activated), domain registrar, phone bill, internet, streaming services. Founder logs each as a recurring Transaction.

---

## Workstream 3 — Tie schedule and finance together

### 3.1 Cross-link
On the schedule's "🛫 Egypt/Yemen prep checklist" row, add a Notion mention link to the runway dashboard page so when the founder opens the prep checklist a month out, they see their runway state right there.

Same for Brazil prep.

### 3.2 Weekly review checklist
Create a sub-page in the schedule database called **"🪞 Weekly review (Sunday template)"**. Content: a check-the-box template the founder duplicates each Sunday.

Sections (each with a checkbox):
- [ ] Check runway (open the Runway dashboard)
- [ ] Log this week's transactions
- [ ] Confirm next week's events
- [ ] Refill any prescriptions running low
- [ ] Clear inbox
- [ ] Pick the ONE thing that matters next week

---

## Workstream 4 — Rewrite log

Create a page called **"Personnel rewrite log — 2026-06-14"** at the same level as the schedule and finance DBs.

Document everything you did, in this format:

```
## Schedule rewrite
- Existing schedule found at: <Notion link>
- Properties added: <list>
- Views created: <list>
- Events seeded: <count>
- Subscribe instructions: <link>

## Finance dashboard
- Existing finance DB found at: <link or "none">
- Database created at: <link>
- Sources: Transactions, Budget plan
- Charts/views: <list>
- Runway dashboard: <link>
- Pending action items: <list>

## TODOs for human
- <each TODO with the page/property it lives on>
```

---

## Final steps

1. Print the rewrite log content as the final output of your run.
2. Print every Notion page URL you created or modified so the founder can open them.
3. Print a `READY` line at the end so the founder knows it's safe to open Notion.

---

## If you're stuck

If the Notion MCP errors on creating a chart block, fall back to a standard table view and add a `> TODO (HUMAN):` to insert the chart manually. Do not stop the run — keep going on the other tasks.

If you can't find the founder's existing schedule, **create a new one** under the same parent as the SwingBy Waitlist DB. Don't try to be clever about parent location — the founder will move it later.

## Go.
