# Block 1 Companion — Bug Fixes + Polish While Human Tests Mobile

You are operating autonomously in bypass-permissions mode. The founder is actively testing the mobile app end-to-end on iPhone (Expo Go pointing at backend on 10.0.0.53:8000). Your job is to **fix the bugs they just spotted** + **prepare what they'll need next** without breaking their live testing session.

This brief is scoped to roughly 1–2 hours of work. Stop at ~70% context.

---

## SAFETY — read twice

1. **The backend MUST keep running** on `10.0.0.53:8000`. Do NOT restart it. Edit files freely — uvicorn `--reload` picks up changes. But if you break the backend, the founder's mobile testing breaks too.
2. **Do NOT touch `.env*` files** anywhere.
3. **Do NOT touch `.claude/secrets/*`**.
4. **Do NOT call n8n MCP tools.**
5. **Do NOT call Supabase write tools** (`execute_sql`, `apply_migration`). Reads OK.
6. **Do NOT modify** `backend/app/api/auth.py`, `deps.py`, `main.py`, `limiter.py`, `supabase_client.py`. The admin endpoints in `admin.py` got new routes tonight — those are fine to extend further if needed.
7. **No destructive git ops.**
8. Commit per workstream. Push after each so the founder can pull and see results.

---

## Context — what's currently broken or rough (founder feedback)

**Mobile (iOS, screenshots shown):**
- ❌ Home/Browse screen returns 500 from `GET /businesses/nearby` — "No businesses nearby" message shows but error toast underneath
- ❌ Post-a-Job → **Details** screen has placeholder text overlapping the entered text in description + address fields
- ❌ Post-a-Job → **Budget & timing** screen has same overlap on the time field (preferred date OK, preferred time overlapping)
- ❌ Post-a-Job → **Confirm** screen — submission fails with "String should have at least 3 characters" because backend min-length is 3 but no client-side hint to the user
- ❌ **Settings screen** looks unappealing — described as "like MetaTrader 4 beta" — needs a visual polish pass
- ⚠️ Address input is just a text field — needs to be searchable/autocomplete (Google Places)
- ⚠️ Time picker is a free-text field — needs to be native iOS-style scrollable wheel
- ⚠️ Zero seed businesses in DB → every "browse" / "nearby" view is empty → can't visually test trust cards

**Web launch site:**
- ⚠️ Business dashboard needs visible analytics like the mockup the founder showed (Jake's Lawncare-style: total earned, jobs completed, avg rating, escrow, recent jobs table, escrow tracker, team-on-duty)
- ⚠️ Admin app at `localhost:5175/users` was blank — backend GET endpoint just added in `admin.py` — verify it works; same for `/bookings`
- ⚠️ Admin dashboard could use the same analytics-style cards

**Future (capture in roadmap, do NOT build tonight):**
- Multi-stop routing for business with multiple bookings in a day (Uber-style chained stops)
- Multi-language support (i18n) — scaffold only
- Business bidding marketplace (eBay-style) — roadmap doc only

---

## Workstream A — Backend bug fixes (do FIRST; 15 min)

### A1 — Diagnose the 500 on `/businesses/nearby`
1. Read `backend/app/api/businesses.py` — find the `nearby` handler.
2. Look for: missing lat/lng, divide-by-zero on Haversine, RLS rejecting service-role queries, etc.
3. The most likely cause: handler calls `.execute()` on Supabase and crashes when `data` is empty, OR client sends lat/lng as strings not floats.
4. Fix it. Add a try/except returning empty list `[]` gracefully if no businesses match.
5. Log the actual error path with `structlog` so future 500s show up in uvicorn console.

### A2 — Make the post-job validation error friendlier
1. Backend Pydantic `service_posts` model requires `description` min 3 chars. Don't change the backend.
2. In mobile `mobile/src/screens/PostJobScreen.js` (or equivalent step file), add client-side validation: disable the "Next" button if description < 10 chars OR show a real hint "Describe in at least 10 characters."
3. Same for address: min 5 chars.

---

## Workstream B — Mobile bug fixes (text overlap) (~25 min)

### B1 — Fix placeholder overlap on PostJob inputs

The overlap is almost certainly an **uncontrolled `TextInput` rendering both a `placeholder` AND a `value` simultaneously**, OR a custom floating-label component that doesn't move the placeholder when there's a value.

1. Read `mobile/src/screens/PostJobScreen.js`.
2. Read whatever custom `<Input>` or `<TextField>` component the Post Job flow uses (probably `mobile/src/components/Input.js` or similar).
3. Fix the label/placeholder so it animates **up** when the field has a value (floating label pattern) OR simply hides the placeholder when value is non-empty.
4. Apply the same fix to ALL multi-step Post Job screens.

### B2 — Fix overlap on Budget & timing → preferred time field

Same pattern — the placeholder "10:00 AM" is showing UNDER the entered value. Fix the input component.

### B3 — Visual audit pass on Settings screen

Open `mobile/src/screens/SettingsScreen.js`.
- Make it match the visual quality of the Profile screen the founder showed (clean cards, good spacing, soft borders).
- Items should be: Account → Edit profile, Language, Notifications. Privacy & Legal → Privacy Policy, Terms of Service, Export my data, Delete account. Support → Help & FAQ, Contact us. Then Sign Out + version.
- Use the existing theme tokens. Don't invent new colors. Match the rest of the app.
- Specifically: increase section padding, soften the dividers, make icons consistent size (24px), add subtle hover/press state.

---

## Workstream C — Searchable location + native time picker (~30 min)

### C1 — Address autocomplete with Google Places

1. Install `react-native-google-places-autocomplete` if not already there: `npx expo install react-native-google-places-autocomplete`.
2. Replace the address TextInput in PostJobScreen with the autocomplete component.
3. Google Places API key is in `mobile/.env` or `mobile/app.json` — check; if not, use a placeholder `GOOGLE_PLACES_API_KEY` env var and leave a `> TODO (HUMAN): get Google Places API key from Google Cloud Console` block.
4. On select, set both the display string AND the lat/lng on the post.

### C2 — Native scrollable time picker

1. Replace the free-text time field with `@react-native-community/datetimepicker` (likely already installed since the date picker works).
2. Use `mode="time"`, `display="spinner"` on iOS for the scroll-wheel look the founder wants.
3. Show the picker as a modal sheet when the field is tapped, then format the chosen time as "10:00 AM" in the field.

---

## Workstream D — Seed data: 1 business per category (~20 min)

The founder needs to visually test "trust cards" — they need data.

### D1 — Write the seed SQL

1. Read `backend/app/api/businesses.py` to confirm the businesses table schema.
2. Categories (read `web/launch/src/data/categories.json` if it exists, else use): house cleaning, handyman, dog walking, personal training, lawn care, snow removal, electrical, plumbing, moving, painting.
3. Write `docs/wave-10-seed-businesses.sql` with **one business per category**:
   - Realistic name (e.g. "Beltline Sparkle Cleaning", "Mission Handyman Co.", etc.)
   - Real-looking lat/lng around Calgary (51.04, -114.06 base)
   - service_radius_km 5-15
   - avg_rating 4.5–5.0
   - review_count 8–40
   - license_status: 'verified'
   - owner_id: pick from existing public.users with role='business_owner' (use the seed accounts), or use NULL where the column allows
4. Include rollback statements at the bottom (commented out).
5. Mark with `> TODO (HUMAN): apply this seed via Supabase MCP when ready to populate browse views`.

### D2 — Verify nearby endpoint will work once seeds applied

Read the nearby handler one more time to make sure the inserted businesses' lat/lng + radius would actually return results for a Calgary search.

---

## Workstream E — Web business dashboard analytics (~30 min)

The founder showed a mockup ("Jake's Lawncare" dashboard) with: total earned, jobs completed, avg rating, in escrow, recent jobs table, escrow tracker bar, team-on-duty card.

### E1 — Audit existing business dashboard

1. Read `web/launch/src/pages/app/BusinessDashboard.jsx`. What's there now?
2. Read `web/launch/src/pages/app/BusinessAnalytics.jsx`.

### E2 — Add the missing pieces

Based on the mockup the founder showed:
- KPI strip: 4 cards (Total Earned, Jobs Completed, Avg Rating, In Escrow). Each shows current value + delta vs last period.
- Recent jobs table: client, service, date, worker, amount, status badge.
- Escrow tracker: progress bar showing $released / $held.
- Team on duty today: list of employees with job counts.

Use Recharts for any charts. Use existing `<Card>` and `<StatCard>` components if they exist; create if not.

**IMPORTANT**: Currently `GET /businesses/me/analytics` may not exist as a backend endpoint. If it doesn't, render the dashboard using the existing `/bookings` and `/businesses/me` endpoints + client-side aggregation. Leave a `> TODO (HUMAN):` to add a proper analytics endpoint later for performance.

---

## Workstream F — Admin analytics dashboard (~20 min)

### F1 — Audit `web/admin/src/pages/DashboardPage.jsx`

What's there now?

### F2 — Add platform-level KPIs

- Total users (by role: client / business_owner / employee / admin)
- Total bookings (this week / month / all time)
- GMV (gross merchandise value)
- Platform revenue (10% of GMV)
- Active businesses (with at least 1 booking last 30d)
- Recent signups list
- Recent bookings list
- Dispute count (if dispute table exists)

Use the new `GET /admin/users` + `GET /admin/bookings` endpoints. Aggregate client-side.

---

## Workstream G — i18n scaffold (do NOT translate everything; scaffold only) (~15 min)

The founder wants multi-language support. Set it up without doing full translation tonight.

### G1 — In `web/launch`
1. `npm install i18next react-i18next i18next-browser-languagedetector`
2. Create `src/lib/i18n.js` — config with EN as default, FR and AR (Arabic — founder's email suggests Arabic background) as secondary.
3. Create `src/locales/en.json`, `src/locales/fr.json`, `src/locales/ar.json` — each with the same key structure. For EN: real text. For FR/AR: leave keys with empty strings and a TODO note.
4. Wire `<I18nextProvider>` in `main.jsx`.
5. Convert a few high-visibility strings on Home page as proof: hero headline, CTA buttons. Leave a TODO for the rest.

### G2 — In `mobile`
- Already has `mobile/src/i18n.js` — check its current state.
- Make sure it's wired up and has EN/FR/AR keys for at least: tab labels, common buttons (Browse, Post a Job, My Jobs, Messages, Profile), Login screen.

---

## Workstream H — Roadmap docs for future features (~10 min)

Capture, don't build:

- Create `marketing/roadmap/multi-stop-routing.md` — describe the Uber-for-multiple-clients vision. 1 page. Use cases, dependencies, MVP scope, post-MVP. Reference Apple Maps + Google Maps deep-link patterns.
- Create `marketing/roadmap/business-bidding.md` — eBay-style bidding for big jobs. Use cases, mechanics (auction window, reserve price, bid notifications), risks (race conditions, gaming).
- Create `marketing/roadmap/i18n-rollout.md` — what languages, ordered by Calgary demographics. Suggest: EN, AR, FR, TL (Tagalog), ZH (Mandarin) based on Calgary census data. Translation pipeline + reviewer plan.

---

## Final steps

1. `grep -rE "(sk_live|sk_proj-|xoxb-|xoxp-|EAA[a-zA-Z0-9]{20,}|secret_[a-zA-Z0-9]{20,})" mobile/ web/ backend/ marketing/ 2>/dev/null | head -10` — must be empty.
2. Commit per workstream:
   - `fix(backend): handle empty nearby businesses gracefully (Workstream A)`
   - `fix(mobile): floating label inputs + settings polish + post-job validation (Workstream B)`
   - `feat(mobile): google places autocomplete + native time picker (Workstream C)`
   - `feat(seed): one business per category for visual testing (Workstream D)`
   - `feat(web/launch): business dashboard analytics with KPI cards + recent jobs (Workstream E)`
   - `feat(web/admin): platform analytics dashboard (Workstream F)`
   - `feat(i18n): scaffold EN/FR/AR for web + mobile (Workstream G)`
   - `docs(roadmap): multi-stop routing, business bidding, i18n rollout (Workstream H)`
3. Push after each commit.

---

## SUMMARY block at end

```
BLOCK 1 COMPANION SUMMARY
=========================
Workstreams completed:
  A — backend bug fixes:    <Y/N>
  B — mobile UI bug fixes:  <Y/N>
  C — autocomplete + time:  <Y/N>
  D — seed businesses:      <Y/N>
  E — business dashboard:   <Y/N>
  F — admin dashboard:      <Y/N>
  G — i18n scaffold:        <Y/N>
  H — roadmap docs:         <Y/N>

Bugs fixed: <N>
Files created: <N>
Files modified: <N>
Commits pushed: <N>

TODOs left for human (do these to unblock):
  - apply docs/wave-10-seed-businesses.sql via Supabase
  - get Google Places API key
  - <anything else>

What to test on mobile after pulling:
  - <bug 1 — should now be fixed>
  - <bug 2 — should now be fixed>
```

---

## Go

Read `CLAUDE.md` first to anchor on voice + schema. Then start with **Workstream A** because it unblocks the founder's testing right now (the 500 error is in their face). Then B (UI bugs). Then everything else in any order.

If anything blocks you, drop a `> TODO (HUMAN):` and continue.
