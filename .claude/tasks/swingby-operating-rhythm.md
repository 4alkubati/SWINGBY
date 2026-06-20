# SwingBy Operating Rhythm — Long-Run Scheduling System

You are operating autonomously in bypass-permissions mode. Your job is to build the **scaffolding** that keeps SwingBy alive during stressful months: a recurring calendar of operational tasks, a Gmail-based lead pipeline, a legal cadence, and a renewals tracker. Manual first. Automate later.

This is not a content-generation run. **Do not write marketing copy, blog posts, or content drafts** — Wave 1 and Wave 2 already produced months of that. This run is purely operational scaffolding using Calendar + Gmail (and Notion sparingly).

---

## Hard rules

1. **NO code changes** anywhere in `mobile/`, `web/`, `backend/`. Read-only on those.
2. **NO `.env*` access**.
3. **NO n8n MCP calls**.
4. **NO Supabase writes**.
5. **NO Notion writes by default.** Last Notion run damaged the founder's workspace. Use **Google Calendar + Gmail** as the primary system. Only touch Notion if Workstream F explicitly requires it AND only by creating ONE root page; everything else is calendar events and Gmail labels.
6. **Calendar events created** must include start, end, recurrence rules, reminders, description, and category color. No half-events.
7. **Gmail drafts** are saved as **drafts** (not sent). Founder reviews each before any send.
8. **Document every change** in `docs/ops/operating-rhythm-log.md` with timestamps + tool used + entity ID.
9. **No future calendar pollution** — never create more than 12 months of any single recurring event; let recurrence do the work.

---

## Mission

Build the system where:
- Every recurring operational task is a calendar event with a reminder.
- Every category of outbound work has a Gmail label and a draft template.
- Every renewal that could break SwingBy if missed is a calendar event 30 days before it expires.
- Every legal/financial milestone has a "do this thing on this date" entry.
- The founder can take a 1-month trip (Egypt Sept 2026, Brazil Feb 2027) without operational drift.

---

## Founder context (read first)

- **Solo founder** running SwingBy (Calgary services marketplace).
- **Travel constraints:** Egypt/Yemen Sept 2026 (~1 month) → SwingBy public launch early Oct 2026 → Brazil Feb 2027 (~1 month).
- **Email:** 4alkubati@gmail.com
- **Calendar:** Google Calendar primary; iPhone Calendar subscribes.
- **Timezone:** Mountain Time (America/Edmonton)
- **Previous work tonight:** mobile fixes, web/launch analytics, n8n workflows partially wired, marketing content libraries written (don't redo).
- **Stripe:** not yet integrated. Will be added before public launch.
- **Resend:** not signed up yet.
- **Domain:** swingby.ca (registrar unknown to you — leave a TODO to verify).

---

## Workstream A — Daily + weekly operating rhythm (Calendar MCP)

Create these as recurring events in Google Calendar. Use color: blue for SwingBy ops, green for finance, purple for legal, red for renewals.

### Daily (Mon-Fri, business days only)
| Time | Title | Reminder | Notes |
|---|---|---|---|
| 09:00–10:00 | 🎯 Cold outreach hour | 10 min | Send 5 new + follow up 5 existing |
| 17:00–17:30 | 📨 Inbox triage | none | Clear Gmail, label new leads |

### Weekly
| Day | Time | Title | Reminder | Notes |
|---|---|---|---|---|
| Monday | 09:00–10:00 | 📊 Weekly KPI review (open dashboard) | 30 min | Check WATB, bookings, GMV |
| Monday | 14:00–15:00 | 🎤 User interview slot (booked or buffer) | 1 day | Auto-block; cancel if no one booked |
| Wednesday | 10:00–11:00 | 📞 Cold call / DM hour | 30 min | Phone or IG DM 5 Calgary businesses |
| Friday | 16:00–17:00 | 📝 Weekly recap + plan next week | 1 hour | Write 3 lines: shipped, broke, next |

### Biweekly
| Cadence | Title | Notes |
|---|---|---|
| Every other Tuesday 11am | 🐛 Bug triage hour | Review Sentry, GitHub issues, customer reports |
| Every other Thursday 10am | 📣 Marketing content review | Review last 2 weeks of posts + engagement |

---

## Workstream B — Monthly operating rhythm (Calendar MCP)

Each runs on the 1st of every month at 10am unless noted.

| Title | Notes | Reminder |
|---|---|---|
| 💰 Stripe payout reconciliation | After Stripe is live | 1 day |
| 🧾 Subscription audit (cancel anything unused) | Open Cloudflare/Render/Supabase/OpenAI/Anthropic dashboards | 1 day |
| 📈 Monthly KPI report (write the email even if you don't raise) | 30 min draft | 1 day |
| 🏥 Refill prescriptions check | Pharmacy + insurance | 1 week |
| ⚖️ Legal touchpoint — email lawyer "anything urgent?" | After lawyer is found | 1 day |
| 🎯 5 customer interviews booked? | Calendar reality check | 1 day |
| 🧹 Cleanup: archive old Slack channels, prune Notion garbage | 30 min | none |
| 15th of month: 📊 Investor update (write it even if not raising — practice) | Half-page email | 1 day |

---

## Workstream C — Quarterly + annual operating rhythm (Calendar MCP)

### Quarterly (first Monday of Jan, Apr, Jul, Oct, 9am)
| Title | Notes | Reminder |
|---|---|---|
| 🔒 Security audit (npm audit, Sentry trends, RLS spot check) | 2 hours | 1 week |
| 🔑 Rotate API keys (OpenAI, Slack, Notion, Meta, Resend, Stripe restricted keys) | 1 hour | 1 week |
| 📊 NPS survey send to all active users | Via Resend | 3 days |
| 🤝 Customer advisory call — 3 active businesses, 30 min each | 90 min | 1 week |
| 💸 Cash flow projection — next 6 months | 1 hour | 1 day |

### Annual (set as recurring yearly)
| Date | Title | Reminder |
|---|---|---|
| January 15 | 🏢 Corporate filing renewal (Alberta) | 1 month |
| January 31 | 📋 T4 / GST/HST prep with accountant | 1 month |
| April 1 | 💼 Tax filing deadline prep | 2 weeks |
| Renewal date (TBD) | 🌐 Domain renewal — swingby.ca | 1 month |
| Renewal date (TBD) | 🛡️ Business insurance renewal | 1 month |
| Anniversary of incorporation | 🎉 Anniversary recap + reflection blog post | 1 day |

For TBD dates, create the events on best-guess dates and append "(VERIFY DATE)" to the title.

---

## Workstream D — Pre-trip operational lockdown (Calendar MCP)

Two trips coming up. Each needs a 30-day-prior lockdown sprint.

### Egypt/Yemen — Sept 2026
| When | Title |
|---|---|
| 2026-08-15 | ✈️ Egypt prep T-2 weeks: write status doc, brief any advisor |
| 2026-08-22 | ✈️ Egypt prep T-1 week: confirm autoresponders, schedule social, run final tests |
| 2026-08-29 | ✈️ Egypt prep T-3 days: monthly close, all systems green check |
| 2026-09-01 | ✈️ Egypt departure (placeholder — VERIFY DATE) |
| 2026-09-30 | 🇨🇦 Egypt return — start SwingBy launch sprint (placeholder) |

### Brazil — Feb 2027
| When | Title |
|---|---|
| 2027-01-15 | ✈️ Brazil prep T-2 weeks |
| 2027-01-22 | ✈️ Brazil prep T-1 week |
| 2027-01-29 | ✈️ Brazil prep T-3 days |
| 2027-02-01 | ✈️ Brazil departure (VERIFY DATE) |

Each prep event description should include the "before I leave" checklist:
- All recurring outreach paused or queued
- Out-of-office on email + Slack
- Sentry + Render + Supabase health checks scheduled
- Trusted contact who can reach me in emergency
- Stripe payout schedule confirmed
- Personal: prescriptions refilled, dentist, haircut

---

## Workstream E — Gmail lead pipeline + labels (Gmail MCP)

### E1 — Labels
Create these Gmail labels (use `create_label`):

| Label | Purpose |
|---|---|
| `SwingBy/Leads/To-contact` | Cold leads not yet emailed |
| `SwingBy/Leads/Reached-out` | First email sent, awaiting reply |
| `SwingBy/Leads/Replied` | Got a response, in conversation |
| `SwingBy/Leads/Demo-booked` | Booked a call |
| `SwingBy/Leads/Signed-up` | Active on the platform |
| `SwingBy/Leads/Lost` | Said no or ghosted after 3 emails |
| `SwingBy/Press` | Journalists, podcasts |
| `SwingBy/Partners` | Chambers, associations, suppliers |
| `SwingBy/Investors` | If/when raising |
| `SwingBy/Hires` | Candidates (post-launch) |
| `SwingBy/Vendors` | Render, Cloudflare, Supabase, etc. — for renewals |
| `SwingBy/Legal` | Lawyer correspondence |
| `SwingBy/Customers` | Real users, support threads |

### E2 — Cold email draft templates
Create these as Gmail drafts (use `create_draft`). To: leave blank. Subject + body filled in.

**Draft 1: Cold v1 — Calgary tradesperson initial**
```
Subject: 30-second ask, Calgary founder

Hi [first name],

I'm Amr — Calgary founder building SwingBy. It's a booking-and-payment platform for local service businesses (cleaning, handyman, lawn care, etc.). Think Uber-for-services but escrow-protected so your clients can't haggle the price down after the job's done.

We launch publicly in October. I'm picking the first 100 businesses to onboard now. Want to be one of them? 15 min Zoom or coffee?

Amr
4alkubati@gmail.com
swingby.ca
```

**Draft 2: Cold v2 — follow-up after 5 days no reply**
```
Subject: re: 30-second ask, Calgary founder

Hi [first name],

Following up on my note from last week. We're still picking the first 100. Two perks if you sign up before launch:
- 5% take rate instead of 10% (locked for 6 months)
- Free Verified Business badge for year 1 ($99 value)

Easier path: reply with "yes, send details" and I'll send a 1-paragraph summary plus a calendar link.

Amr
```

**Draft 3: Cold v3 — final breakup (after 14 days no reply)**
```
Subject: Last note from me

Hi [first name],

No reply means now's not the right time — totally understand. I'll close your spot in the first 100.

If anything changes, swingby.ca. Otherwise — wishing you the best.

Amr
```

**Draft 4: Press pitch — Calgary Herald business desk**
```
Subject: Calgary founder, services-marketplace launch (Oct 2026)

Hi [reporter name],

I'm Amr, founder of SwingBy — a Calgary-built booking-and-payment platform for local service businesses, launching in Calgary in October.

Why it might fit your beat:
- Built in YYC, focused on YYC first (we have no plans to expand outside Alberta until 2027).
- 10% take rate vs Thumbtack's lead-fee model — the cheapest credible rate in the category.
- Escrow-protected payments — protects tradespeople from being haggled down after the job is done. (This is the founder story — happy to share more.)

Happy to set up a Zoom or coffee. I can also send a 1-pager.

Amr
```

**Draft 5: Partner pitch — Calgary Chamber of Commerce**
```
Subject: SwingBy x Calgary Chamber — partnership idea

Hi [contact name],

I'm Amr, founder of SwingBy (services marketplace for Calgary, launching Oct 2026). I'd love to explore a partnership:

- Chamber members get 1 year of Featured listing + Verified badge free (= $447 value/year)
- In return: a mention in your member newsletter + inclusion in your "tools for new businesses" page

Quick 15 min Zoom this or next week?

Amr
```

**Draft 6: Investor cold — placeholder, not sending until raising**
```
Subject: SwingBy — services marketplace, Calgary (not raising yet, building relationships)

Hi [investor name],

Amr, founder of SwingBy. Quick intro before I'm raising:

[3 sentence pitch]
[1 sentence traction stat]
[Ask: would love a 20-min get-to-know-you call]

Amr
```

### E3 — Saved searches the founder runs weekly
Create these as Gmail searches the founder can save to bookmarks. Document them in the operating-rhythm log.

- `label:SwingBy/Leads/Reached-out older_than:5d -label:SwingBy/Leads/Replied` → who needs a follow-up
- `label:SwingBy/Leads/Reached-out older_than:14d -label:SwingBy/Leads/Replied` → who needs the breakup
- `label:SwingBy/Customers is:unread` → customer threads needing reply
- `label:SwingBy/Vendors subject:(invoice OR renewal OR expiring)` → financial / renewal flags

---

## Workstream F — Legal cadence + lawyer-finding playbook (Notion + Calendar)

### F1 — Find a startup lawyer (manual, the founder does this)
Create a one-time calendar event next Monday at 11am: **"⚖️ Lawyer search — 2 calls booked by end of week"**.

In the description, paste this checklist:
```
TARGET: 2 Calgary startup lawyers, get a 30-min intro call each, then pick one.

WHERE TO LOOK:
- Calgary Startup Lawyer LinkedIn search
- Startup Calgary slack / discord (ask for referrals)
- Cooley GO / Osler open-source SAFE docs (mention you're using them)
- Trade-school career services (sometimes have networks)

QUESTIONS TO ASK ON THE CALL:
1. Marketplace platform liability — what does Alberta law say about us being a platform vs. service provider?
2. Escrow + payment law — anything special with Canadian payment processing?
3. Worker classification — if we ever hire, what's the W2 vs 1099 equivalent here?
4. Insurance recommendations — what's table stakes for a marketplace?
5. Terms enforceability — anything in our current terms that won't hold up in Alberta court?
6. Engagement model — flat retainer, hourly, or à la carte? Cost?

BUDGET: $200-500 for an initial consultation. Pass on anyone above $750/hr.
```

### F2 — Notion page (ONE PAGE, sparingly)
This is the only Notion write in this entire brief. Create ONE page called **"SwingBy Ops"** under the founder's main Notion area. Single page, no sub-databases, no schema engineering. Content:

```
# SwingBy Ops

The boring stuff that keeps SwingBy alive. Updated [date].

## Calendar lives at
Google Calendar (4alkubati@gmail.com) — subscribed in iPhone Calendar.

## Gmail labels live at
mail.google.com → left sidebar.

## Lawyer
- Name: [TODO after lawyer search]
- Email: [TODO]
- Rate: [TODO]
- Date last reviewed: [TODO]

## Accountant
- Name: [TODO after finding accountant]
- Same fields as lawyer

## Renewals next 90 days
- (auto-pull from calendar — manually keep this list short)

## Open legal questions
- (running list)

## Open operational risks
- (running list)
```

If creating this Notion page fails or feels risky, leave a `> TODO (HUMAN): create this Notion page manually` in the operating-rhythm log. Do not try to be clever about Notion structure — the last run made it worse.

---

## Workstream G — Lead-finding playbook (Markdown file, no automation)

Create `docs/ops/lead-finding-playbook.md`. Content:

### Sources of Calgary leads (manual, do every Wednesday)
- **Google Maps**: search `[category] [neighbourhood] Calgary`. Click each result → website → contact form / email. Target 20 names per session.
- **Instagram**: search `#calgary[category]` (e.g. `#calgarycleaning`). DM the small business owners. Avoid the big franchises.
- **Facebook groups**: "Calgary Buy & Sell," "Calgary Small Business Owners," "Calgary Trades & Services." Don't post unless you've engaged for a week. Then post a humble "I'm building X, would love feedback."
- **LinkedIn Sales Navigator**: free trial, then $99/mo. Filter by: Calgary, company size 1-10, industry = consumer services. Skip if first 30 leads from free sources don't convert.
- **Yellow Pages**: still alive. Trade-specific lookups.
- **Trade association directories**: Calgary Construction Association, Alberta Cleaners' Network, Pet Industry Joint Advisory Council, etc.
- **Referrals from existing leads**: every conversation, ask "do you know 2 other tradespeople I should talk to?"

### What to log per lead (do in Gmail label + sender + thread, NOT a CRM yet)
- Source (Maps / IG / FB / LinkedIn / etc.)
- First touched (date)
- Last touched (date)
- Their category (cleaning / handyman / etc.)
- Neighbourhood
- Reply rate marker (replied yes / replied no / ghosted)

### When to upgrade to a CRM
- When you have 100+ leads, Gmail labels stop scaling.
- Recommendation: Attio (free for first 100 records) or HubSpot Free (CRM only, skip everything else).
- Do NOT pay for Salesforce, Pipedrive, or anything > $50/mo in year 1.

### Cold call etiquette (since some leads only have a phone number)
- Call between 10am-11am or 2pm-3pm local time.
- Open with: "Hi, this is Amr, Calgary founder. I'm building a marketplace for local service businesses and I have a 60-second pitch — is now a bad time?"
- If they say bad time: "Totally — what's a better time to call back?" Set a calendar event.
- If they say go ahead: 30-second pitch, 30-second ask. Don't oversell.

---

## Workstream H — Renewals + safety net tracker (Calendar MCP)

Create one-off calendar events 30 days BEFORE each of these. If exact date unknown, use today + 90 days as placeholder and tag "(VERIFY DATE)":

| Item | Title | Recurrence |
|---|---|---|
| Domain swingby.ca | 🌐 Domain renewal — swingby.ca | Yearly |
| Cloudflare account | ☁️ Cloudflare plan review | Yearly |
| Render plan | 🖥️ Render plan review | Monthly |
| Supabase plan | 🗄️ Supabase plan review | Quarterly |
| OpenAI API key | 🤖 OpenAI key rotation + spend check | Quarterly |
| Slack workspace | 💬 Slack workspace review | Quarterly |
| Google Workspace (if paid) | 📧 Google Workspace renewal | Yearly |
| Apple Developer Program | 🍎 Apple Dev renewal ($99/yr) | Yearly |
| Google Play Developer | ▶️ Google Play Dev renewal ($25 one-time but check) | Yearly |
| Business license (Alberta) | 🏢 Alberta business license renewal | Yearly |
| Insurance (when bought) | 🛡️ Insurance renewal | Yearly |

---

## Workstream I — Travel-safe defaults (Gmail + Calendar)

Set up the founder's "I'm leaving the country for a month" defaults so they're easy to flip on.

### I1 — Gmail vacation responder templates (saved as drafts, NOT activated)
Create draft labeled "Travel/Vacation responder — Egypt 2026":
```
Subject: Out of office — back [return date]

Hi,

Thanks for your email. I'm traveling abroad and away from my desk from [start] to [end].

For SwingBy customer issues: please email support@swingby.ca (response within 24h).
For SwingBy partner / press inquiries: I'll reply when I'm back.
For anything urgent: text [phone number] — but please only if truly urgent.

Amr
```

Same for Brazil 2027.

### I2 — Calendar block of trip days
Already covered in Workstream D. Confirm done.

### I3 — Pre-trip system check calendar event
Add an event 7 days before each departure: **"🛫 Pre-trip system check"**. In the description:

```
30-min checklist:
☐ Sentry alerts on, configured to my phone
☐ Render auto-deploys on?
☐ Cloudflare DDoS protection on?
☐ Stripe payouts on automatic schedule
☐ Vacation responder ON
☐ Slack status set to "Out of office until [date]"
☐ Most recent backup confirmed
☐ Trusted contact briefed (who reaches me if emergency?)
☐ Phone number for emergency: [TODO]
```

---

## Workstream J — Operating-rhythm log file

Create `docs/ops/operating-rhythm-log.md`. For every Calendar event, Gmail label, draft, file, and Notion page you created in this run, log:

```
| When | Tool | Action | Entity | ID / URL |
|---|---|---|---|---|
| 2026-06-14 23:45 | Calendar | Created event | "Cold outreach hour" daily Mon-Fri 09:00 | <event ID> |
| ... | ... | ... | ... | ... |
```

Include a section at the bottom:

```
## TODOs left for human (in order of importance)
1. ...
2. ...

## Things I didn't do because of safety rules
- ...
```

---

## Final steps

1. Print the operating-rhythm log content as your final output.
2. Print every Calendar event ID + Gmail label ID + Gmail draft subject + the Notion page URL (if created).
3. Print `READY` so the founder knows you're done.

---

## If you're stuck

- Calendar MCP failing: fall back to a markdown file `docs/ops/calendar-schedule.md` listing every event the founder needs to create manually. Don't stop the run.
- Gmail MCP failing: same — fall back to a markdown file `docs/ops/gmail-labels-and-drafts.md`.
- Notion failing: skip the Notion page entirely. Do NOT retry. The founder will create it by hand.

Do not stop the run waiting for the founder. Drop `> TODO (HUMAN):` blocks and keep moving.

## Go.
