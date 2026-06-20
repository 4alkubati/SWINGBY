# JUNE — Beta Sprint (Jun 18–24) · the 4 dominoes

> Phase 1. Goal of the week: a real tester completes a booking on a real device, with a real email. One domino per day, weekends for the heavy lifts.

---

## Thu Jun 18 — Domino 1: Email sends
**☀️ Morning:** read brief · paste RESEND_API_KEY into backend env once domain = Verified · 5 beta-recruit DMs.
**🌙 Night lock-in:** agent finishes Resend wiring → send yourself a test signup → **email lands = D1 done.**
**🛌 Overnight:** start D2 (Home screen real data).
**Win:** a real signup email arrives.

## Fri Jun 19 — Domino 2: Kill mock data (start)
**☀️ Morning:** brief · stock recatch (your cal) · 5 DMs.
**🌙 Night:** dispatch mobile-agent → wire Home/Nearby (C7) to `/businesses/nearby`. Verify real businesses show.
**🛌 Overnight:** continue to Dashboard (C8).
**Win:** Home screen shows real data, not mock.

## Sat Jun 20 — Domino 2 finish + Domino 3 start (BIG block)
**☀️ Morning:** bike · brief.
**🌙 Deep work (12–9):** finish Dashboard (C8) + Chat polling (C9) → all core screens real. Then start D3: real Google Maps key in EAS, kick first `eas build`.
**Win:** zero mock data left; first build running.

## Sun Jun 21 — Domino 3: Installable build
**☀️ Morning:** brief · reset.
**🌙 Deep work:** finish EAS build → upload to TestFlight (iOS) + Play internal → seed accounts log in on a real phone.
**Win:** you can install SwingBy on a real device.

## Mon Jun 22 — Domino 4: End-to-end run
**☀️ Morning:** brief · invite 1–3 testers (friends/trades you know).
**🌙 Night:** with a tester, run the full flow: post → quote → accept → complete → review (sandbox payment). Log every bug.
**Win:** a real person completes a booking. **BETA LIVE.**

## Tue Jun 23 — Fix what beta broke
**Night:** triage tester bugs → dispatch agents to fix top 3. Re-test.

## Wed Jun 24 — Stabilize + recruit more
**Night:** fix remaining bugs · invite 5 more testers · update STATUS + plan next week.

---
**End-of-week win condition:** ≥1 tester completed a full booking, emails firing, top bugs fixed. If yes → Phase 1 done, roll into July polish.
