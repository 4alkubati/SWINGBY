---
type: audit
status: active
date: 2026-08-13
source: 15 screenshots, inbox/debugging/01–15.png
tags: [walkthrough, bugs, dominoes]
---

# 🁢 Walkthrough audit — 2026-08-13

**Evidence:** 15 screenshots from a real preview build, `inbox/debugging/01–15.png`,
numbered in capture order (22:11 → 22:25). Every finding below was then traced to
a `file:line` in this repo. Nothing here is inferred from a test result.

**Why this document exists.** Three builds shipped with the same defects while
tests stayed green. That is not bad luck, it is a measurement failure, and §0
explains it before anything else.

---

## §0 — Why "verified" has not meant "works"

Every verification loop in this repo reads **source text**, not rendered output.

* `pushed-screens-have-a-way-back.test.js` asserts a screen **imports**
  `ScreenHeader`. It cannot see whether a back control renders, is on screen, or
  is reachable. Its own docstring records that the previous regex passed "on pure
  accident" by matching `chevron-left` in a swipe hint.
* That same test **exempts seven screens**: `NearbyMap`, `ActiveBooking`,
  `Search`, `Chat`, `MessageThread`, `BusinessProfile`, `JobManagement`.
  **Six of the eight defects below are on that list.** The screens hardest to
  verify by reading source are the ones still broken.
* `claim_lint.py` already states the rule and we ignored it: *"Anything that
  describes money must also be checked against rendered output — a screenshot of
  the real screen — not just against source and tests."*

**Consequence:** a green suite is evidence that the code compiles and the units
behave. It is not evidence that the product works. Until a screen is looked at,
it is unverified — regardless of coverage.

---

## §1 — The eight defects, worst first

### D-W1 · The app runs in Ukrainian while Settings says EN 🔴 BLOCKER
**Evidence:** `09.png` (Settings), `08.png` (Dashboard).
Language chip reads **EN**. On screen: `БЕЗПЕКА`, `Заблоковані акаунти`,
`Розблокування Face ID / відбитком`, `Режим невидимості`, `Видалити акаунт`,
`НАСТУПНА РОБОТА`, `ГРОШІ В РУСІ`, `На депонуванні`, `Переказано`.

**Root cause — proven, not guessed:**
1. English is present and correct (`i18n.js:1671` → `'settings.ghostMode': 'Ghost mode'`;
   `moderationEn` → `'moderation.blockedAccounts': 'Blocked accounts'`). This is
   **not** a missing-translation fallback.
2. `i18n.js:3051` assigns the locale inside a **fire-and-forget async IIFE** at
   module import (`SecureStore.getItemAsync` → `i18n.locale = stored`).
3. `SettingsScreen.js:52` does `useState(i18n.locale)` — captured **once, at
   mount**, which happens *before* that IIFE resolves. The chip therefore
   captures the constructor default `'en'` and never re-reads.
4. The real locale settles to `uk`. Ukrainian has 468 keys; the app uses more, so
   keys absent from `uk` fall back to English — producing the exact
   half-Ukrainian screen in `09.png`.

**Why it matters more than it looks:** a business owner opening SwingBy sees a
language they did not choose, on the screen that holds *delete account* and
*blocked accounts*, and the Language row tells them they are already in English —
so they will never think to change it.

**Secondary defect:** `i18n-locales.js` advertises 14 locales (`pa, tl, zh-Hans,
zh-Hant, es, ur, vi, ko, ru, uk, hi, …`) while only `en`, `fr-CA`, `ar`, `uk`
have catalogues. The registry offers languages the app cannot render.

---

### D-W2 · A job can never be completed 🔴 BLOCKER
**Evidence:** `11.png`.
> **Error** — Cannot complete: this booking has not been paid. No Stripe charge
> was captured and no off-platform payment was recorded, so there is no money to
> release to the business.

The FINDING C guard is working *correctly*. The defect is everything around it:

* `04.png` shows the same booking as **"Accepted · $180 paid"**.
* `04.png` *also* shows, 100 px above, **"pending payment · $180"**.
* `02.png` lists it under **"Needs action → Propose a time"**.
* `01.png`/`03.png` show it as **"Confirmed"**.

Four surfaces, four different truths about one booking. The business marks the
job done, gets refused, and **there is no route forward** — this is the dead end
reported as "I get to a page and there is no escaping it".

**This is the money model colliding with the UI.** Money is collected at accept
(`acceptAndPay.js`); these bookings have no capture, so they can never complete,
yet every list treats them as live work.

---

### D-W3 · Profile completeness demands fields that cannot be entered 🔴
**Evidence:** `07.png` ("57% — Add a description to…"), `14.png` (edit mode).

`BusinessProfileScreen.js:67 computeProfileCompleteness` counts **7** fields:

| counted | present | editable in the app |
|---|---|---|
| `business_name` | ✅ | ✅ |
| `category` | ✅ | ✅ |
| `service_radius_km` | ✅ | ✅ |
| `logo_url` | ✅ | ✅ |
| **`description`** | ❌ | **no input exists** |
| **`photos`** | ❌ | **no input exists** |
| **`services`** | ❌ | **no input exists** |

4 / 7 = **57%**, exactly what the screenshot shows. A grep for a description
input returns **zero hits**.

So the meter instructs the owner to add a description, and the product provides
no way to add one. **57% is a ceiling, not a state.** Every business will sit
there forever, being nagged.

Compounding: `07.png` says *"No services listed yet — the trades you picked
during setup show here"* while `14.png` shows `CATEGORY = Moving`. The copy
promises a thing the code never populates.

---

### D-W4 · Money contradicts itself on one screen 🔴
**Evidence:** `04.png` — booking summary says **"pending payment · $180"**; the
quote card directly beneath says **"Accepted · $180 paid"**.
**Evidence:** `08.png` — `THIS WEEK $0` + `-100% vs last week` while
`Переказано (transferred) $367`.

This is the exact class `CLAUDE.md` documents as killed four times. It is alive.

---

### D-W5 · Owner is labelled "New to the team" 🟠
**Evidence:** `01.png`, `03.png` — "Amr Basem · Owner · **New to the team** · 18
days with Amr's Moving Company".
The trust-card tenure logic is applied to the business owner. The owner is not
new to their own company. It undermines the exact trust signal it exists to build.

---

### D-W6 · Dead controls presented as live 🟠
**Evidence:** `05.png` — **Withdraw** and **Edit quote** rendered as buttons,
greyed, with "Changing a sent quote isn't available yet — message the client
instead."
Two buttons that look tappable and do nothing, plus an apology. If it is not
built, it should not be drawn.
**Also:** the same header shows the client as literally **"Client"**, while
`04.png` shows the same person as "Amr Alkubati" — name resolution works on the
booking thread and fails on the quote thread.

---

### D-W7 · Layout breaks on real strings 🟠
* `02.png` — the tab label **"Needs action (2)"** wraps to two lines and
  overflows its pill, colliding with "Scheduled (2)" and "Past (4)".
* `07.png` — completeness tip truncates mid-sentence: *"Add a description to…"*.
* `13.png` — the SINCE stat renders as **"2026"** with **"Jul"** on a separate
  line below the label.
* `11.png` — the status chip row shows **Started** as not-done while the live
  timeline below logs **"Job started · 9:20 PM"**.

---

### D-W8 · Stale and invented data on customer-facing surfaces 🟠
* `03.png` — confirmed date **"Sunday, August 9 · 11:36 PM"**. That is four days
  in the past and 11:36 PM is not a service window; it reads as a creation
  timestamp rendered as an appointment.
* `04.png` — the Terms sheet pre-fills **"Hallway repaint / Two coats on all four
  walls"** for a **moving** job. Placeholders are hardcoded for painting.
* `15.png` — *"Amr's Moving Company usually replies within a few hours"* for a
  business with **0 jobs**. An invented SLA — the same `§4` claim family the
  linter reports 81 of.
* `13.png` — owner profile shows **0 JOBS** while the Jobs tab shows **Past (4)**.
* `06.png`/`14.png` — the business logo is a **photograph of a monitor** showing
  the SwingBy logo, and `07.png` grades it "Added ✅".

---

## §2 — What is genuinely good, and should not be touched

Being brutal cuts both ways. These are right, and rebuilding them would be waste:

* **`15.png` "Request sent"** is the best screen in the app. Honest 3-step
  explanation, and *"No payment yet. Nothing is charged until you accept."* is
  exactly true to `acceptAndPay.js`. Ship more screens like this.
* **The money guards themselves.** FINDING C refusing an unpaid completion
  (`11.png`) is the system working. The bug is the surrounding lies, not the guard.
* **The design language.** Dark theme, spacing, type, and the card system read as
  a real product. This is not a prototype look.
* **The backend.** 1087 tests, e2e smoke green, the escrow ladder, RLS posture on
  the Google tables. The server is in better shape than the client.

---

## §3 — The bottleneck, stated plainly

**It is not engineering throughput. 36 PRs merged in 6 days.**

The bottleneck is a **verification loop that cannot see the product**. Every one
of the eight defects above is visible within 60 seconds of opening the app, and
none was catchable by the tooling we have been trusting. We have been building
fast and measuring the wrong thing.

Second bottleneck: **one person is the only pair of eyes.** Nothing enters the
bug list until Kira runs the app and screenshots it.

---

## §4 — What would actually improve this, vs what would not

| Would move the needle | Would not |
|---|---|
| A **screenshot gate**: any change to the 7 exempt screens closes only with an image of the real screen | More unit tests on those screens — they already pass |
| **Delete the locale registry entries with no catalogue** (10 of 14) | Translating 10 more languages |
| Make completeness **count only editable fields**, or build the 3 missing inputs | Tuning the percentage maths |
| **One money-truth component** every surface reads | Fixing each contradicting label in place |
| A **seeded demo account** whose data is coherent | More demo rows |

---

## §5 — Fix order for the next build

Ordered by "what makes the walkthrough feel finished", not by effort.

1. **D-W1** locale race — one-line-ish fix, removes Ukrainian everywhere. Highest
   visible impact per unit of work in the entire app.
2. **D-W2** the unpayable booking — either backfill/repair those rows or give the
   business a route out. Nothing else matters if a job cannot finish.
3. **D-W3** completeness — stop counting uneditable fields (fast), then build the
   description + photos + services inputs (real work).
4. **D-W4** one money component, one truth.
5. **D-W5 / D-W6 / D-W7** — owner tenure, dead buttons, tab overflow.
6. **D-W8** — dates, placeholders, the invented SLA line, the logo.

---

## §6 — Method note for whoever picks this up

Do not close any of these on a passing test. Close them on an image of the screen
from a build. That rule is the actual deliverable of this document; the eight
defects are just what it caught the first time it was applied.

---

## §7 — Closed 2026-08-14 (append-only)

PR #157 closed D-W1 through D-W7 and part of D-W8, and recorded the rest as
open rather than quietly dropping it. This pass closes the remainder.

### D-W8 · the past-dated appointment — CLOSED

#157 called this "data-shaped… needs the booking data traced". It was not data.
It was a picker default, and the trace ends at a line of code.

`PostJobScreen.js` initialised its time picker to `new Date()` — the current
instant, **including the current minutes**. A client posting at 11:36 PM who
opened the time picker and tapped **Done** without scrolling — because the value
displayed looked like a chosen value — set `preferred_date` to 11:36 PM that
same night. `interests.py:385` copies `preferred_date` to `confirmed_date` at
accept, skipping the handshake. Four days later that renders as an appointment
in the past. The non-zero minutes were the tell: a picker anchored to noon or a
whole hour cannot produce `:36`.

* the picker now opens at **9:00 AM** and steps in **15-minute** intervals, so
  the default reads as a proposal and `:36` is not reachable;
* `bookingBuckets.isPastDue()` is new, and `ActiveBookingScreen` now labels a
  passed date **"Was scheduled for"** instead of **"When"** — the business view
  already handled this, the client view did not;
* the `bookingBuckets` docblock claiming `confirmed_date` is *always* null while
  status is `confirmed` is corrected. It has been false since the preferred-date
  path shipped, and it is exactly the kind of stale comment that produces a
  wrong guard next time.

### D-W8 · 0 JOBS vs Past (4) — CLOSED

Two different questions rendered under one label, and both numbers were right.

`employees.py` counted `bookings.employee_id = <this employee> AND
status='completed'`. `JobManagementScreen` counts *business*-scoped past work,
which includes cancelled. An owner's `employees` row is materialised lazily by
`_ensure_owner_employee`, so bookings handled before that — or handled without
assigning anyone — carry no `employee_id` at all, and the owner's own trust card
read 0 while their Jobs tab read 4.

* for an **owner**, `jobs_completed` now counts the business's completed
  bookings. For a real staff member it stays employee-scoped, because that is
  *their* record and inflating it with work they did not do is the opposite of
  a trust signal. Same reasoning D-W5 applied to tenure;
* **found on the way:** `GET /businesses/{id}` has attached `completed_bookings`
  since the stat shipped and `GET /businesses/me` never did — so a client saw
  the real figure and the owner saw the stat disappear entirely.

### D-W7 · the SINCE stat — CLOSED

**This was still open and was being counted as closed.** #157's D-W7 work was
the tab row only; the audit lists two separate items under D-W7 and the second
was never touched.

`EmployeeProfileScreen` split `"Jul 2026"` across `value` and `sub` — and `sub`
renders *below* the label, so the card read:

```
2026
SINCE
Jul
```

A date torn in half around its own caption. It is one value and now renders as
one; `StatItem` shrinks to fit rather than forcing the caller to chop the string
up.

### Method note

Per §6, none of these is closed on a passing test. They are closed in source
with tests pinning the logic, and they stay **test-verified** until they are
seen on a build.
