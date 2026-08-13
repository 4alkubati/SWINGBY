# Walkthrough queue — 2026-08-06

Raised by Kira during the iOS walkthrough. Each item below is marked with what
was **verified against code or production**, versus what is still his report
awaiting a repro. Nothing here is assumed from an older doc.

> ⚠️ **Read this first.** The build Kira walked was made *before* today's merges.
> At least one item (W2) looks **already fixed on `main`**, so re-test on the
> new build before spending a minute on it. Fixing something twice is the
> cheapest mistake available here and this repo has made it before.

---

## W1 — `www.swingbyy.com` does not exist · **VERIFIED BROKEN**

`dig www.swingbyy.com` returns **nothing at all** — not a misconfigured record,
no record. Apex `https://swingbyy.com` answers **200**; `https://www.swingbyy.com`
fails to connect (curl `000`).

This is already filed as **D19** in `Roadmap/HUMAN-TODO.md`. One Cloudflare
action: **DNS → CNAME `www` → `swingbyy.com`, proxied.** Not a code change, and
no agent can do it.

**Open question — the iOS URL.** Kira reports the app showing
`www.swingby.com` (single `y`). That string does **not exist anywhere in this
repo** — a full-tree grep for `www.swingby.com` and `//swingby.com` outside
`node_modules` returns zero hits, and `mobile/app.json`, `mobile/eas.json` and
all of `mobile/src/` reference only `swingbyy.com`. So it is coming from
somewhere outside the codebase — most likely a field typed into an external
console (Stripe's "business website" prompt, or an Apple record). **Need to know
which screen he saw it on before this can be fixed.**

---

## W2 — Solo business must auto-assign the owner · **LIKELY ALREADY FIXED — RE-TEST**

Kira's rule: *if the business has one person, the assignee is always the owner,
until a second person exists.*

The backend already implements this. `bookings.py:211` defines
`OWNER_SENTINEL = "owner"`, and `PATCH /bookings/{id}/assign-employee` accepts it
at line 680, materialising the owner's `employees` row via
`_ensure_owner_employee` so the booking carries a real `employee_id` like any
other assignment. `JobManagementScreen.js:198` carries a comment describing the
exact bug being reported — *"solo business saw 'No active employees found.' and
could not assign the job to anyone"* — and says `/assignees` now always includes
the owner.

**So this reads as fixed on `main` and absent from the walked build.** Re-test
on the new build first. If it still reproduces, the fault is in the mobile
wiring, not the API.

---

## W3 — A booking can be completed with no employee assigned · **VERIFIED OPEN**

`PATCH /bookings/{booking_id}/complete` (`bookings.py:1081`) checks role,
existence, not-already-completed, and ownership — and **never checks
`employee_id`**. A `null` assignee completes and releases escrow exactly like an
assigned one.

Kira hit this in the walkthrough. With W2's rule in place the field should never
be null by completion time, so the fix is two-sided:

1. auto-assign the owner for a solo business (W2), and
2. **guard `/complete`** so a booking with no `employee_id` cannot be marked
   done.

Worth deciding whether the guard is a hard 400 or an auto-assign-then-complete
for the solo case. A hard 400 on a solo business that never saw an assign screen
would be a dead end, so the guard must land *after* W2 is confirmed working.

---

## W4 — The assigned person must show in the client's booking details · **NOT YET VERIFIED**

Kira: *"once assigned it should automatically show up in the details for who is
going, so the client can see."*

`bookings.py` already resolves an assignee block (`employee_id → employees →
users`, line 202) and `_completed_job_counts` feeds a "jobs completed" figure,
so the data exists server-side. **Not yet checked** whether
`BookingDetailsScreen` renders it on the *client* side — that is the next thing
to look at.

---

## W5 — Propose/accept time leaves the CTA stale · **NOT YET INVESTIGATED**

Kira: *"after I proposed a time and I accepted it, it still says assign time /
propose time."*

Relevant endpoints exist: `PATCH /bookings/{id}/propose-dates` (line 822) and
`PATCH /bookings/{id}/confirm-date` (line 933). Symptom points at the screen not
re-reading state after the handshake closes, or at a CTA whose condition tests
the wrong field — the same shape as the double-charge bug in
`booking-payment-gating.test.js`, where the gate tested a status literal nothing
ever wrote.

Reproduce, then check what the CTA condition actually reads.

---

## W6 — Migrate Google reviews · **DEAD until someone applies to Google**

**Settled by Kira, 2026-08-06:** *"its a maps key, we never applied for business
profile access."*

So the verified key is a **Maps/Places** key. It does not grant the
`business.manage` scope the importer needs, and no code change can substitute
for it.

The feature itself is **fully built** — `backend/app/api/google_reviews.py`
(eight endpoints: `status`, `connect`, `callback` GET+POST, `locations`,
`import`, `disconnect`, `business/{id}`) plus `mobile/src/services/googleReviews.js`
— and correctly gated. Probed live 2026-08-06, `GET /google-reviews/status`
returns `enabled: false`, `status: "coming_soon"`, and the UI renders a calm
"coming soon" with no button. **Nothing is broken and nothing is exposed.**

**The only work is an application to Google for Business Profile API access.**
That is a human task with a review turnaround measured in weeks, so it should be
started early or dropped from the launch scope on purpose — not left implicitly
"almost done". Filed for HUMAN-TODO.

Do not spend engineering time here until that approval exists.

## W7 — Google sign-in consent screen shows the Supabase project, not SwingBy · **REAL, but not the risk it looks like**

Kira: *"when I signed up through Google it didn't say SwingBy needs access, it
said the Supabase id and Supabase."*

**The security fear is unfounded, and worth writing down so it is not re-raised.**
Seeing the project ref does **not** let anyone log in to Supabase. The ref is not
a credential — it is part of the OAuth redirect URL
(`https://<ref>.supabase.co/auth/v1/callback`) by design, and is visible to every
user of any Supabase-backed app. Dashboard access needs Kira's own Supabase
account and MFA. Nothing about seeing that string grants any access.

Checked and clean: **the mobile app carries no Supabase credentials at all.** A
grep across `mobile/src/`, `mobile/app.json` and `mobile/.env.example` for
`SUPABASE` returns **zero** hits — auth runs through the FastAPI backend
(`/auth/social/authorize` → `/auth/social/exchange`), so there is no anon key in
the bundle for anyone to abuse.

**What IS a real problem** is trust. A consent screen naming an unknown vendor
instead of SwingBy reads as phishing to a normal user, and it will not survive
Google's OAuth verification review, which requires branding tied to a verified
domain.

Fix, free, no code:
**Google Cloud Console → APIs & Services → OAuth consent screen** — set **App
name** to `SwingBy`, a support email, the app logo, and `swingbyy.com` under
both *App domain* and *Authorized domains*.

The smaller line still showing `supabase.co` only disappears with a **Supabase
Custom Domain**, which is a **paid add-on**. Given the standing "no paid
subscriptions yet" rule, brand the consent screen now and treat the custom
domain as a launch-time decision, not a blocker.

---

## Priority

W3 and W2 are one piece of work and touch money (escrow releases on complete).
W5 is a visible correctness bug in the booking flow. W1 is one Cloudflare click
plus a question. W4 is small once located. W6 is unscoped and should not jump
the queue until the API question above is answered.

---

## W8 — Client cannot see the business arriving; the hero looks like a flat image · **CAUSE FOUND**

Kira: *"in the progress details the customer still isn't able to see the business
arriving or their location — the image on top still renders a normal image."*

There are **two** independent causes and they need separating, because fixing
one does not fix the other.

### Cause A — the hero map is hardcoded to MapCanvas, even on iOS · VERIFIED

`ActiveBookingScreen.js:212` states the choice outright: *"MapCanvas rather than
react-native-maps deliberately: the walkthrough device is a Huawei with no Play
Services, so a real map renders nothing there."* That reasoning was correct for
the Huawei — and it was **never made conditional**. A grep of
`ActiveBookingScreen.js` for `react-native-maps` / `MapView` / `services/maps`
returns **zero** hits: the hero draws the custom canvas on every platform.

Kira is now walking on **iOS**, where Apple Maps renders perfectly. So the main
"where are they" screen shows a flat drawn surface — exactly "a normal image".

`ProviderLiveLocation.js` already solves this properly and is the pattern to
copy: it imports `{ MapView, Marker, MAP_PROVIDER }` from `services/maps`
(line 42) and renders a **real map when one can draw**, falling back to
MapCanvas when it cannot (line 119). The hero should do the same. Note this is
the same `services/maps` split introduced by X3 so iOS gets Apple Maps and
Android keeps Google — the hero simply never adopted it.

### Cause B — no dot exists unless the provider is actually sharing · BY DESIGN

`backend/app/api/booking_location.py` opens the feed only inside a server-side
window: an "on my way" event opens it, and `arrived` / `started` / `completed`
close it. Outside that window `GET /bookings/{id}/location` returns
`sharing: false` with **no coordinates**, and `ProviderLiveLocation` renders
nothing rather than a stale or guessed pin. The provider must also be PUTting
fixes from `LiveLocationSharing` on `JobManagementScreen`.

So an empty map is the **correct** output when the business never tapped "on my
way" or never granted location permission. Before calling this broken, drive it
from both sides: business taps on-my-way and allows location, client watches.

**Fix A regardless** — it is wrong on iOS whether or not anyone is sharing.
Then re-test B with two devices before touching the location code.
