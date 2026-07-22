---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# SwingBy Launch Day Script — Hour-by-Hour

**Date:** TBD (fill in before launch)  
**Time zone:** Mountain Time (MT)

---

## Pre-Dawn — 5:00 AM

- Wake up. Eat something real.
- Open laptop. Run smoke test on staging: sign up a test client, post a job, log in as test business.
- Confirm backend is live: `GET /health` returns 200.
- Confirm Supabase dashboard shows 0 alerts.
- Confirm web app loads and auth flow works end-to-end.

**If anything breaks:** fix it now before anyone sees. Do NOT launch broken.

---

## 7:00 AM — Final checks

- [ ] Re-run `web/launch` smoke test in Chrome, Safari, Firefox mobile
- [ ] Verify waitlist import is ready in email provider (double-check count)
- [ ] Confirm social accounts logged in and ready (IG, LinkedIn, Twitter/X)
- [ ] Re-read today's launch copy one last time
- [ ] Post personal note to yourself: "This is the day."

---

## 8:00 AM — Go live

**Action: Flip the live switch (remove maintenance mode if set)**

Send the waitlist launch email (Variant A — see `waitlist-launch-email.md`):
- Subject: "SwingBy is live. You're first."
- List: full waitlist
- Click send. Screenshot the send confirmation.

---

## 8:15 AM — Instagram

Post #1 (announce — see `launch-day-instagram.md` Post 1):
- Upload the image/graphic
- Caption + hashtags
- Add to Story as well (link sticker to swingbyapp.com)

---

## 8:30 AM — Twitter/X

Post the launch thread (see `launch-day-twitter.md`):
- Post tweet 1, reply with 2, reply with 3 ... through 10
- Pin tweet 1 to your profile

---

## 9:00 AM — LinkedIn

Post founder personal LinkedIn post (see `launch-day-linkedin.md` Post 1):
- From your personal profile
- Don't cross-post company page yet — let the personal post breathe

---

## 9:30 AM — Direct outreach begins

Work through `founder-friends-asks.md`:
- Text/DM the 10 closest friends and family first
- Ask for a download, a share, or a review — pick one per person
- Keep it personal, no copy-paste blasts

---

## 10:00 AM — Monitor

Check:
- Backend error logs (Supabase logs, Render/server logs)
- First signups? Note the count.
- Any crash reports from Sentry
- Email open rate (first look)

**Do not make code changes unless something is down.** Resist the urge.

---

## 11:00 AM — Instagram Story #2

Behind-the-scenes: you at your desk, first signups coming in. Short, real, personal.

---

## 12:00 PM — Midday check-in

- Log signup count
- Check any support emails — reply within 1 hour today
- Note any bug reports. Triage: critical (fix now) vs. minor (log for later)
- Continue DM outreach (next 10 people from the friends list)

---

## 1:00 PM — LinkedIn Company Page post

Post company page version (see `launch-day-linkedin.md` Post 2)

---

## 2:00 PM — Twitter standalones

Post 2–3 standalone tweets from `launch-day-twitter.md`:
- One "how it works" tweet
- One "who it's for" tweet

---

## 3:00 PM — Engagement window

For 30 minutes, reply to every comment, DM, and email.
No templates today — be the founder. Write real sentences.

---

## 4:00 PM — Instagram Story #3

"A few hours in..." — what you're seeing, how it feels. Keep it real.

---

## 5:00 PM — Calgary-specific outreach

Message any Calgary-area communities you're part of:
- YYC Facebook groups (Calgary Residents, etc.)
- Reddit r/Calgary if the post feels genuine
- Any local Slack communities

**Use the specific Calgary-native copy from the friends-asks doc.**

---

## 6:00 PM — IG Post #2

Behind-the-scenes post (see `launch-day-instagram.md` Post 2)

---

## 7:00 PM — Founder note post (IG)

Post founder note (see `launch-day-instagram.md` Post 3)

---

## 8:00 PM — Evening pulse check

- Log: signups, active sessions, error count, support tickets
- Any show-stoppers? Fix if yes.
- Share a brief update with anyone helping you (co-founder, advisor, family)

---

## 9:00 PM — Final social push

LinkedIn network ask (see `launch-day-linkedin.md` Post 3)

---

## 10:00 PM — Wind down

- Send a personal note to your most important supporters — the people who helped you get here
- Write 3 sentences in a private doc: what happened today, one thing that surprised you, one thing you want to fix tomorrow
- Close laptop by midnight

---

## Midnight — Day 1 done

You launched. Whatever the numbers are — you launched.

The work continues tomorrow. Sleep.

---

## Numbers to track all day

| Metric | 8am | 12pm | 6pm | Midnight |
|---|---|---|---|---|
| Signups | | | | |
| Client accounts | | | | |
| Business accounts | | | | |
| Jobs posted | | | | |
| Interests expressed | | | | |
| Email open rate | | | | |
| Support tickets | | | | |

---

## Emergency contacts

- Supabase status: status.supabase.com
- Your server/hosting status page: TBD
- Sentry: your Sentry dashboard URL
- Your most trusted technical contact: [name + number]

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[founder-friends-asks]] · [[launch-day-instagram]] · [[launch-day-linkedin]] · [[launch-day-twitter]] · [[waitlist-launch-email]]
<!-- graph-wire:end -->
