---
type: domino
id: D5
status: deferred
phase: 2 — POLISH + PREP
started:
done:
links: [[../DOMINOES]]
prev: [[D4-friend-tester]]
next:
tags: [domino, distribution, eas, app-store, money]
---

# 🁢 D5 — Hire real dev testers (paid distribution)

> Index: [[../DOMINOES|DOMINOES]] · Prev: [[D4-friend-tester|D4]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

SwingBy installs on testers' phones via TestFlight (iOS) + Play internal (Android). 3–5 paid testers run a structured bug bash.

This is the **Phase 2** domino — only starts after [[D4-friend-tester|D4]] declares **BETA LIVE**.

## 🤔 Why this is parked behind money + a successful D4

Per [[../../AGENTS/claude/memory/HUMAN-TODO|HUMAN-TODO.md]]: "DO NOT spend money until the mobile app is finished + testers lined up." A D4 that passes is the trigger to spend.

## 💸 Cost summary

| Item | Cost | Recurrence |
|---|---|---|
| Apple Developer Program | $99 USD | per year |
| Google Play Console | $25 USD | one-time |
| EAS Build (free tier) | $0 | covers ~30 builds/mo |
| Paid testers (e.g., 3 × $50) | $150 | one-time bug bash |
| **Total to start** | **~$275** | |

## ✅ Pre-reqs

- [ ] [[D4-friend-tester|D4]] passed: real human completed a real booking.
- [ ] You have a tester recruiting plan (where you'll find paid testers — friends-of-trades, Calgary Slack groups, Upwork, etc.).
- [ ] App icon + screenshots ready ([[../../design]]).

## 🪜 Step-by-step

### 1. Pay the gatekeepers
- Apple Developer: [developer.apple.com/programs](https://developer.apple.com/programs/) — $99/yr, enroll as individual or entity. ~24–48 h to clear.
- Google Play: [play.google.com/console](https://play.google.com/console/) — $25 one-time.

### 2. EAS account + project
- `npx eas-cli login`
- `npx eas-cli init` (in `[[../../mobile]]`)
- Confirm `app.json` has correct `ios.bundleIdentifier` + `android.package`.

### 3. Real Google Maps key (replace placeholder)
- Google Cloud Console → Maps SDK for Android + iOS → key restricted by package name + bundle ID.
- Paste into `app.json` android.config.

### 4. First build
```
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```
~15–25 min per build first time.

### 5. Distribute
- iOS: `npx eas-cli submit --platform ios` → TestFlight internal testers.
- Android: `eas submit --platform android` → Play internal testing track.

### 6. Recruit + brief 3–5 paid testers
- Each tester gets a structured script: (a) sign up, (b) post a job in your trade, (c) complete the flow, (d) leave a review, (e) fill a Google Form with 10 questions.
- Pay on completion.

### 7. Bug bash week
- Daily triage of the form responses + reported bugs.
- 🔴 blockers fixed within 24h. 🟡 majors weekly. 🟢 minors → backlog.

### 8. Decide: Phase 3 ready?
If 3+ testers completed the flow + critical bug rate is < 1/tester → ready for **Phase 3 public launch** (August).

## 🏁 Done-rule

- [ ] 3+ paid testers completed at least one full booking each.
- [ ] Structured feedback collected.
- [ ] Critical bugs < 1 per tester.
- [ ] Decision logged on Phase 3 readiness.

## 📖 Log (append-only)

### YYYY-MM-DD — first entry template
- What you did:
- What broke:
- What you decided:

## 🎓 Learning

- _to fill as you go_
