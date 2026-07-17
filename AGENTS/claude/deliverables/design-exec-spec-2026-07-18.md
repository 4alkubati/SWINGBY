# Design Execution Spec — Jet × Pulse Mock Atlas → RN Implementation

> Bus request 20260717-1001. Design-agent output. Read this instead of re-opening
> `design/handoff-mocks-2026-07-17/swingby-mocks-standalone.html` — every mock's content
> is described here in RN terms (existing components + `theme/tokens.js` + `theme/typography.js`).
> **Do not copy HTML/CSS from the mock file.** This spec is implementable standalone: a
> mobile-agent working one screen only needs that screen's section below.

## How the atlas was read

The HTML is a bundler-packed page; the visible mock markup lives inside a `<script
type="__bundler/template">` JSON string. It was extracted programmatically (`json.loads`
on that blob), then each of the 31 `data-screen-label` sections was isolated and stripped
to structural/text content for comparison against the live RN file at the same path.

**Screen count: 31 target files, 32 mock frames.** `business/BusinessProfileScreen.js` is
the target for two mock frames — "Business Profile (public)" (client viewing a business)
and "My Business (owner view)" (business viewing its own profile). They're one screen
entry below (#10) covering both view-states, since they share one target file. Every
other mock maps 1:1 to a target file. All 31 target files exist under `mobile/src/screens/`
— **no missing target files to report.**

The mock atlas has **no loading/empty/error states drawn** — every frame is a single
happy-path illustration. Where the current RN file already has richer state handling than
the mock shows (loading skeletons, error banners, empty states), that is called out as
"exceeds mock" rather than a gap — do not strip working state handling to match a static
mock.

## Cross-screen findings (read once, applies to multiple entries)

- **`NearbyCard` component** (`mobile/src/components/NearbyCard.js`) has no `verified` or
  `category` prop. Three screens' mocks (Search, Favorites, Nearby Map) show a "Verified"
  badge and a category label on business cards that this shared component cannot render.
  Fixing `NearbyCard` once fixes all three screens — see Search entry (#7) for the full spec.
- **`TextField`** (`mobile/src/components/TextField.js`) has no `maxLength`/character-counter
  rendering. PostJobScreen's mock shows a "112 / 500" counter under the description field;
  today `maxLength` isn't even wired as a prop. Fix once in the shared component.
- **Trend/delta indicators** (↑18%, ↓4 min, ↑6 pts) appear repeatedly in the Business
  Analytics mock but nowhere in the current component set. No shared component exists for
  "value + direction arrow + sentiment color." Recommend a small `TrendDelta` component
  (props: `direction: 'up'|'down'`, `sentiment: 'good'|'bad'`, using existing
  `colors.success`/`colors.danger` — sentiment must be explicit, not inferred from
  direction, since "response time ↓" is good but "rating ↓" is bad).
  ProgressBar" pattern is hand-rolled independently in `PostJobScreen.js`,
  `DisputeFlowScreen.js`, and `BusinessAnalyticsScreen.js` (three near-identical
  `{track, fill}` View pairs using `colors.border`/`colors.accent`). Worth promoting to a
  shared `components/ProgressBar.js` — no new tokens required, pure reuse.
- **Presence / live-status data does not exist anywhere in the backend** (no `online`,
  no read receipts, no employee on-shift status). Every mock-data callout below that needs
  this routes through one new file: **`mobile/src/services/mockPresence.js`** — see the
  dedicated section after the screen entries for its exact contract.
- **Token coverage: no new tokens are needed anywhere in this atlas.** Every gap below is
  closeable with the existing `colors` / `spacing` / `radius` / `shadows` sets. Where a
  screen entry's "Token needs" says "None," that's a confirmed check, not a skip.

---

## 1. MessagesScreen

- **Mock label:** Messages · **Target file:** `mobile/src/screens/messages/MessagesScreen.js`

**Gap list**
- **[P2]** Mock shows no "Quote"/"Booking" pill on rows — current adds one
  (`colors.accentMuted` bg, `colors.accentText` label) to disambiguate pre-booking quote
  threads from booking threads. This is an *improvement* over the mock, not a gap — keep it.
- No other gaps. Loading skeleton, error+retry, search-filtered empty state, and
  pull-to-refresh already exceed what the static mock shows.

**Token needs:** None.
**Mock-data callouts:** None — `/messages/threads` is real data end to end.

---

## 2. ProfileScreen

- **Mock label:** Profile · **Target file:** `mobile/src/screens/profile/ProfileScreen.js`

**Gap list**
- **[P2]** Mock's identity card shows `Calgary, AB · Member since May 2026` — current only
  renders "Member since {date}" (`infoRow` in the `!user?.phone` branch), no city/province.
  `users` has no stored city field today (only lat/lng from onboarding, if captured) — this
  needs a resolved-city string, either reverse-geocoded once at signup and stored, or
  derived client-side from stored lat/lng. Needs a backend decision before mobile can add
  the row; not a pure design fix.
- **[P2]** Mock's "Invite friends" row shows a `$10` badge inline (reward teaser) before
  the chevron. Current `MenuRow` renders icon + label + chevron only, no trailing badge slot.
  Cheap addition: `MenuRow` needs an optional `badge` prop.
- Everything else matches: avatar+name+role pill, edit-in-place (mock doesn't show an edit
  mode at all, current's is a bonus), full menu order (Favorites → Notifications → Payment
  methods → Invite friends → Settings → Help & FAQ → Privacy Policy → Terms of Service →
  Log out) is identical to the mock.

**Token needs:** None.
**Mock-data callouts:** None currently required (city gap is real-data-needed, not mock-data).

---

## 3. PostJobScreen

- **Mock label:** Post Job — step 2 (Details) · **Target file:** `mobile/src/screens/client/PostJobScreen.js`

**Gap list**
- **[P1]** Mock's description field shows a live character counter, `112 / 500`, right-
  aligned under the textarea. Current `StepDetails`'s `TextField` for description has no
  `maxLength` and no counter — and per the cross-screen finding above, `TextField` doesn't
  support one at all yet. Add `maxLength` + counter rendering to `TextField` (small caption,
  `colors.textSecondary`, flips to `colors.danger` past the limit — same pattern already
  used in `DisputeFlowScreen`'s hand-rolled `charCountRow`), then pass `maxLength={500}` here.
- **[P2]** Mock's address step shows a single labeled icon+line ("📍 123 Main St SW,
  Calgary"); current uses `GooglePlacesAutocomplete` with a floating label — functionally
  superior (live autocomplete + lat/lng capture for geo-matching), keep it. Not a gap.
- **[P2]** Mock's photo section copy is "Optional · up to 5" as a static subheading; current
  splits this across the label (`Photos (optional)`) and a hint line under the empty-state
  button (`Businesses see this before quoting`). Equivalent information, different
  placement — no action needed unless mobile-agent wants exact copy parity.
- 4-step wizard (Category/Details/Budget/Confirm), progress bar, step labels, and Back/Next
  navigation all match the mock's step-2 frame exactly.

**Token needs:** None (counter uses `colors.textSecondary`/`colors.danger`, both existing).
**Mock-data callouts:** None.

---

## 4. QuoteComparisonScreen

- **Mock label:** Quote Comparison · **Target file:** `mobile/src/screens/client/QuoteComparisonScreen.js`

**Gap list**
- **[P1]** Mock shows a **"Verified" badge** on the top quote card (green check + label,
  same treatment as `BusinessProfileScreen`'s `license_status === 'verified'` badge).
  Current `QuoteListCard` has no verified badge at all — `businesses.license_status` is
  already fetched as part of the nested `businesses` object on the interests join (same
  field `BusinessProfileScreen` reads), so this is a pure UI addition, no backend work.
- **[P1]** Mock's top badge reads **"RECOMMENDED"**; current reads **"Best value."**
  Copy-only change in `bestBadge` — pick one term app-wide (recommend "Recommended" to match
  the mock, since "Best value" implies price-only ranking when the actual sort also weighs
  rating).
- **[P1]** Mock shows a **quote message bubble** under each business's stats — a short
  note from the business ("Includes all supplies. We can do Saturday 9am…"). The `interests`
  table has no message/note field today (only `quoted_price`, `status`) — confirmed via
  `backend/app/api/interests.py`. This needs a backend schema addition
  (`interests.message` or similar) before the UI can render it; flag to backend-agent.
  Until then, do not fake this text client-side.
- **[P2]** Mock shows **"responds in ~15 min"** per business — a computed median-response-
  time stat. No such field exists on `businesses` or is computed anywhere server-side.
  Needs backend aggregation (median time between post creation and interest creation).
  Lower priority than the message bubble since it's a nice-to-have trust signal, not core
  quote content.
- **[P1]** Mock's footer line: *"Chat opens after a booking is confirmed."* Current shows
  *"Sorted by best rating × price. Tap a name to view profile."* instead — different, both
  useful. Recommend keeping the sort-hint line but adding the chat-timing disclaimer as a
  second small caption beneath it (cheap, high-trust copy, zero backend dependency).

**Token needs:** None (verified badge reuses `colors.success` + `check-circle` icon,
exact pattern already in `BusinessProfileScreen.js`).
**Mock-data callouts:** "responds in ~X min" — until backend computes this, do **not**
mock it client-side; a fabricated response-time estimate is a trust violation for a
trust-first product. Leave it out rather than fake it.

---

## 5. BookingDetailsScreen

- **Mock label:** Booking Details · **Target file:** `mobile/src/screens/client/BookingDetailsScreen.js`

**Gap list**
- None. The mock shows a simple 4-stage status strip + worker card + 4 detail rows + 3
  action buttons. The live screen already implements all of that *and* exceeds it: the
  confirm-date handshake card, `LiveStatusTimeline` (the Live Job Status differentiator),
  `BookingPhotos` (before/after proof-of-work), off-platform "mark as paid" flow, and a
  provider-side client card that doesn't exist in the mock at all. Do not regress this
  screen to match the simpler mock — it is already ahead of spec.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 6. ReviewScreen

- **Mock label:** Review · **Target file:** `mobile/src/screens/client/ReviewScreen.js`

**Gap list**
- **[P1]** Mock shows a job-context subtitle under the business name: *"Deep cleaning ·
  Sat, Jul 11."* Current worker card only shows the avatar/name + generic "How was your
  experience?" — no service category or date. `route.params` already carries `bookingId`;
  either thread `category`/`scheduledDate` through from `BookingDetailsScreen`'s navigate
  call, or fetch the booking here. Cheap, no backend change needed (data already exists on
  the `bookings` row).
- **[P2]** Mock shows four **quick-tag chips** under the stars: "On time," "Professional,"
  "Great value," "Spotless work" — tap to prefill/append to the comment. `reviews` table
  has only `rating` + `comment`, no tags column. Two implementation paths: (a) client-side
  only — tapping a chip appends the phrase into the free-text `comment` field, zero backend
  change; (b) a real `tags` column for structured filtering later. Recommend (a) now, flag
  (b) to backend-agent as a possible post-MVP addition.
- **[P2]** Header copy: mock has no separate header bar, the heading *is* "How was Bow
  River Cleaning?" Current has a generic "Leave a Review" header bar *plus* the same
  question inside the card — slightly redundant but not wrong. Low priority.

**Token needs:** None.
**Mock-data callouts:** None (tags can be built without mock data — see P2 above).

---

## 7. SearchScreen

- **Mock label:** Search · **Target file:** `mobile/src/screens/client/SearchScreen.js`

**Gap list**
- **[P1]** Mock shows a **"Verified" badge** on qualifying results (Bow River Cleaning,
  Maid Masters) and a **result-count header** ("8 RESULTS NEAR YOU") above the list.
  Current has neither: `NearbyCard` has no verified prop (see cross-screen finding at top
  of doc), and `renderContent()`'s `done` branch goes straight into the `FlatList` with no
  count header. Fix:
  1. Add `verified` (bool) prop to `NearbyCard` — small check-circle + "Verified" inline
     next to the rating row, `colors.success`, same treatment as `BusinessProfileScreen`.
  2. Add `category` (string) prop to `NearbyCard` for the label mock shows before the
     rating line (e.g. "Cleaning ·") — see Favorites entry (#9) for the same requirement.
  3. Add a section header (`Text variant="label" color="secondary"`, uppercase,
     `{results.length} RESULTS NEAR YOU`) above the `FlatList` in the `done` branch.
  `businesses.license_status` is already returned by `/businesses/nearby` (same field
  `BusinessProfileScreen` reads) — no backend change for the verified badge. `category` is
  also already on the row. Both are display-only additions.
- **[P2]** Mock has no visible radius pills — current's 5/10/25/50 km `Chip` row is an
  enhancement beyond the mock. Keep it.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 8. NearbyMapScreen

- **Mock label:** Nearby Map · **Target file:** `mobile/src/screens/client/NearbyMapScreen.js`

**Gap list**
- **[P1]** Mock shows a **location/radius pill** near the top of the map ("Kensington · 2
  km radius") that current's overlay controls don't have — current only has a back button
  and a filter button, no reverse-geocoded place name or radius readout anywhere on
  screen. This is a real trust/orientation cue (confirms to the user *where* the app thinks
  they are) that's currently missing. Needs: (a) reverse-geocode `coords` to a
  neighborhood/place name (Google Geocoding API — same key family as Places, already in
  use for address autocomplete elsewhere), rendered in a `glass-lite` pill
  (`colors.overlayScrim` background per the token comment, `radius.pill`), positioned
  top-center under the existing back/filter row.
- **[P2]** Mock shows a "12 PROS NEAR YOU" count, likely as a small label near the same
  pill or the bottom sheet. Cheap to add once `filteredBusinesses.length` is available
  (it already is) — bundle into the same overlay pill from the P1 item above rather than a
  second UI element.
- Pin styling, bottom-sheet business card, and category filter modal all match the mock's
  interaction model (tap pin → sheet → View profile) — no gaps there.

**Token needs:** `colors.overlayScrim` already exists in tokens.js (defined for exactly
this "glass-lite pill on map" use case per its inline comment) — use it, no new token.
**Mock-data callouts:** None (reverse geocoding is real data via Google, not mocked).

---

## 9. FavoritesScreen

- **Mock label:** Favorites · **Target file:** `mobile/src/screens/client/FavoritesScreen.js`

**Gap list**
- **[P1]** Mock shows a **category label** before the rating line on every row ("Cleaning
  ·", "Plumbing ·", "Moving ·") — current's `NearbyCard` usage here (and in Search/Nearby
  Map) has no category prop, so this text never renders anywhere the card is used. Same
  fix as Search entry (#7) — add `category` to `NearbyCard`, pass `item.category` at each
  call site. One component change, three screens fixed.
- **[P1]** Mock also shows the **"Verified"** badge here (Bow River Cleaning) — same
  `NearbyCard` fix as above.
- **[P2]** Mock's empty-state body copy: *"Tap the heart on any business to save it here."*
  Current: *"Tap the heart on any business to save it"* (missing trailing "here.").
  Cosmetic copy parity only.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 10. BusinessProfileScreen (two mock states: public view + owner view)

- **Mock labels:** "Business Profile (public)" and "My Business (owner view)" ·
  **Target file:** `mobile/src/screens/business/BusinessProfileScreen.js` (one file, two
  states already implemented via `isOwnProfile`/`isOwner`/`editMode`)

**Gap list — public view (client looking at a business)**
- **[P1]** Mock's hero shows a **3-stat row**: rating, **"212 jobs done,"** and **"1.2 km
  from you."** Current hero only shows rating+review-count, a category chip, and service
  radius — no jobs-done count and no distance-from-viewer stat anywhere on this screen.
  `business.review_count` is already fetched (used for the "X reviews" text) and can double
  as "jobs done" if that's the intended meaning, or needs a distinct `total_bookings`-style
  field if "jobs done" should differ from "reviews received" — confirm which with
  product/backend before wiring. Distance requires the viewer's coords (already computed
  elsewhere via `getUserLocation()` + the same haversine helper `SearchScreen` uses) passed
  in as a route param or recomputed on this screen — no backend change needed for distance.
- **[P2]** Mock's photo carousel shows a **"+9" overlay** on the last visible thumbnail
  (total-count affordance). Current `PhotoItem`/`FlatList` carousel has no such overlay —
  cosmetic, low priority.
- **[P2]** Mock's Reviews section header has a **"See all"** link; current renders all
  loaded reviews inline with no dedicated reviews list screen to link to. Needs a new
  screen (`ReviewsListScreen` or similar) if the business has many reviews — bigger than a
  polish pass, flag as a possible new screen for a future wave, not urgent since reviews
  are already visible inline.

**Gap list — owner view ("My Business")**
- **[P1]** Mock shows a **profile-completeness meter**: *"86% — add 3 more photos"* with a
  progress bar. Nothing like this exists in the current owner view. This is client-
  computable from fields already fetched (has business_name / has category / has
  description / has ≥1 photo / has ≥1 service / has service_radius_km, etc. — pick ~5–7
  weighted checks) with zero backend change. Use the shared `ProgressBar` pattern flagged
  in the cross-screen findings section.
- **[P2]** Mock's "SERVICES & PRICING" section shows **per-service pricing** ("Deep clean
  — from $150," "Move-out clean — from $220") plus an **"+ Add service"** row. Current only
  renders `business.services` as plain label `Chip`s with no price attached, and edit mode
  only lets the owner change name/category/radius — there's no services-with-pricing
  editor at all. `businesses` has no such structured field (confirmed against
  `backend/app/api/businesses.py` — `BusinessCreate`/`BusinessUpdate` have no `services`
  field). This needs a schema addition (e.g. a `business_services` table: business_id,
  label, price_from) before the UI can be built — flag to backend-agent + database-agent.
- **[P2]** Mock's "MANAGE" section lists **"Working hours — Mon–Sat"** and **"Payout
  account — Connected"** rows neither of which exist in the current owner view or the
  `businesses` schema. Working hours needs a new field (structured hours-per-day, not just
  a free string). Payout account needs Stripe Connect account status, which doesn't exist
  in this codebase yet (Stripe is wired for checkout, not payouts) — this is a backend/
  payments-infrastructure item, not a design fix. Both are legitimate roadmap items; do not
  attempt to fake either in the UI.
- Team grid, employee cards with active/inactive toggle, and the "Manage" deep-link to
  `EmployeeManagement` all already match or exceed the mock.

**Token needs:** None (completeness meter reuses the `ProgressBar` pattern flagged above;
everything else is copy/data, not new visual tokens).
**Mock-data callouts:** None — every gap above is real-data-or-nothing (no presence/mock
data involved on this screen).

---

## 11. EmployeeProfileScreen

- **Mock label:** Employee Profile · **Target file:** `mobile/src/screens/business/EmployeeProfileScreen.js`

**Gap list**
- **[P0]** Mock shows an actual **review list** under "RECENT REVIEWS" (reviewer name +
  stars + comment, 2 example entries). Current screen, when `reviewCount > 0`, renders a
  literal placeholder sentence instead of any reviews: *"{count} reviews — list coming
  with the client→employee review flow."* This is a visible "not built yet" string shown
  to real users — the exact kind of "looks unfinished" defect the design mandate calls
  out. **Root cause is backend, not just UI**: `backend/app/api/reviews.py`'s
  `reviewee_type` only accepts `"business"` and `"client"` — there is no `"employee"`
  reviewee_type today, so there is no data source for this list to render even if the UI
  were built. Fix requires: (1) database/backend-agent to add `employee` as a valid
  `reviewee_type` (or a parallel endpoint scoped by `employee_id`), (2) this screen to then
  fetch and render those reviews using the exact same `ReviewCard`-style layout already
  built and working in `BusinessProfileScreen.js` (reuse, don't reinvent). Until the
  backend lands, replace the current placeholder sentence with a neutral, honest empty
  state ("No reviews yet" — same as the `reviewCount === 0` branch) rather than a string
  that describes unshipped roadmap — a *false* empty state is less jarring than a
  broken-promise string.

**Token needs:** None.
**Mock-data callouts:** None (this is a real backend gap, not something to mock).

---

## 12. MessageThreadScreen

- **Mock label:** Message Thread · **Target file:** `mobile/src/screens/messages/MessageThreadScreen.js`

**Gap list**
- **[P1]** Mock header shows **"Online now"** under the business name, and one message
  bubble shows **"Read 8:44 AM"** under it (read receipt). Neither exists anywhere in the
  backend (no presence table, no message read-state tracking) — this is the exact
  mock-data case called out in the task brief. Route both through
  `mobile/src/services/mockPresence.js` (see dedicated section below) so the screen can
  match the design now without fabricating backend claims elsewhere. `Avatar` already
  supports a `showStatus`/`online` prop (used today in `BusinessProfileScreen`'s
  `EmployeeCard`) — reuse it on the header avatar here, fed by the mock service.
- **[P1]** Mock shows a **job-context strip** under the header: *"Deep cleaning · Sat, Jul
  11 · In progress"* with a **"View"** link to the booking. Current header only shows a
  status chip (`ON_THE_WAY`/`IN_PROGRESS`/etc.) next to the name — no service category, no
  date, no quick link back to `BookingDetailsScreen`. All of that data is already in
  `bookingMeta` (fetched via `loadBookingMeta`) — this is a pure layout addition, no new
  fetch needed. Add a thin row under the header (reuse the `statusChipStyle` mapping
  already defined) with category + date + a "View →" `Pressable` navigating to
  `BookingDetails`.
- **[P2]** Typing indicator: current already *shows* one, but it's a fully local fake
  (triggered after the current user sends a message, never reflects the other party
  actually typing). Not a visual gap vs. the mock (mock doesn't show typing dots at all),
  but worth folding into `mockPresence.js` for consistency so all "presence-shaped" fakery
  lives in one clearly-marked place instead of being partly inline in this screen.

**Token needs:** None.
**Mock-data callouts:** Online status + read receipts + (optionally) typing state — see
`mockPresence.js` section below.

---

## 13. NotificationsCenterScreen

- **Mock label:** Notifications · **Target file:** `mobile/src/screens/profile/NotificationsCenterScreen.js`

**Gap list**
- **[P1]** Mock groups notifications under **date-section headers** ("TODAY," "EARLIER").
  Current `FlatList` renders one flat list with no section headers at all. Fix: bucket
  `notifications` by `relativeTime`-derived day boundary (today vs. earlier, or switch to
  a `SectionList`) and render a `Text variant="label" color="secondary"` header per group
  — same visual language as `SettingsScreen`'s section labels. Pure client-side grouping,
  data already has `createdAt`.
- **[P2]** Mock includes a review-prompt notification with a **star icon** instead of a
  bell. Current `iconForType()` maps `quote|message|booking|dispute|default(bell)` — no
  `review` case, so a review-prompt notification (if one is ever pushed into this list)
  would fall through to the generic bell. Add a `review` → `star` mapping.

**Token needs:** None.
**Mock-data callouts:** None — notifications are real (AsyncStorage-persisted), just needs
grouping logic.

---

## 14. ProfileEditScreen

- **Mock label:** Profile Edit · **Target file:** `mobile/src/screens/profile/ProfileEditScreen.js`

**Gap list**
- **[P2]** Mock implies a functioning photo-change flow; current's avatar tap shows a
  toast: *"Photo upload coming soon."* Honestly labeled, not jarring — same treatment
  pattern as `PaymentMethodScreen`'s Stripe stub. No UI change needed until photo upload
  ships; this is a backend/storage feature (avatar upload to the `job-photos`-style bucket)
  not a design gap.
- Everything else — avatar + camera badge, First/Last/Phone editable fields, locked email
  row with explanatory caption, sticky "Save Changes" CTA — matches the mock exactly.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 15. PaymentMethodScreen

- **Mock label:** Payment Methods · **Target file:** `mobile/src/screens/profile/PaymentMethodScreen.js`

**Gap list**
- **[P2]** Mock depicts a **fully populated saved-cards list** (Visa •••• 4242 "Default,"
  Mastercard •••• 5510, "+ Add payment method," trust footer about Stripe never seeing the
  full card number). Current screen is an intentional, well-executed placeholder — the
  file's own header comment says so (`T68 — PaymentMethodScreen (Stripe placeholder)`) —
  because saved-payment-method storage isn't built on the backend yet (Stripe is wired for
  one-off Checkout sessions via `/payments/stripe/checkout/{bookingId}`, not for a
  Setup-Intent/saved-cards flow). This is **not a design defect** — the "Coming Soon" stub
  is calm, on-brand, and honest. When backend-agent ships saved-payment-method endpoints,
  swap this screen's empty-state branch for a card-list branch using the mock's layout:
  `Surface` rows with a card-brand mark, "•••• last4," expiry, a "Default" pill on one
  card, and a trailing overflow/remove affordance — all buildable from existing components
  (`Surface`, `Text`, `Inline`) with no new tokens.

**Token needs:** None.
**Mock-data callouts:** None (this is a real-backend-required gap, not a mock-data one —
do not fake saved cards on-device).

---

## 16. ReferralScreen

- **Mock label:** Referral · **Target file:** `mobile/src/screens/profile/ReferralScreen.js`

**Gap list**
- **[P0]** The **"Friends joined" / "Earned" stats card is hardcoded to `0` / `$0`
  always** (`<Text variant="h1">0</Text>` / `<Text variant="h1">$0</Text>` are literal
  JSX, not state) — regardless of whether the user has actually referred anyone. There is
  no referral backend at all (confirmed — no referral-related route anywhere under
  `backend/app/api/`), so this can never become true today. A stat card that always reads
  zero, permanently, is a user-visible defect once anyone actually shares their code and
  a friend signs up — it silently under-reports real activity forever. Minimum fix
  available to design/mobile *without* waiting on backend: either (a) remove the stats
  card entirely until it can be real, or (b) relabel it clearly as illustrative /
  "Coming soon" (same honest-stub pattern as `PaymentMethodScreen`) rather than presenting
  static zeros as if they were live data. Do not ship this as-is.
- **[P1]** Mock's referral code is human-readable and branded: **`ALI-SW10`**. Current
  code is `user.id.slice(0, 8).toUpperCase()` — an opaque UUID fragment (e.g. `A1B2C3D4`),
  not memorable or shareable in conversation. This needs backend support (a deterministic,
  readable code generator — first-name + brand suffix + counter, checked for
  collisions) — flag to backend-agent. Not fixable purely client-side without risking
  collisions.
- **[P2]** Copy: mock frames this as two-sided **"GIVE $10 · GET $10"**; current copy
  ("Share SwingBy, get $10 credit") emphasizes only the sharer's side. Both are accurate
  per the product's referral terms, mock's two-sided framing is punchier — copy-only
  change, no functional dependency.

**Token needs:** None.
**Mock-data callouts:** Referral stats (P0 above) — do not synthesize fake non-zero
numbers either; the honest move is to hide/relabel until backend tracks real referrals,
not to invent plausible-looking activity.

---

## 17. CancellationFlowScreen

- **Mock label:** Cancellation Flow · **Target file:** `mobile/src/screens/flows/CancellationFlowScreen.js`

**Gap list**
- **[P2]** Mock's fee description ties the amount directly to job context in one line:
  *"50% of $180.00 · Deep cleaning, Sat Jul 11."* Current's `penaltyDesc` states the
  percentage and dollar amount but not the category/date in the same sentence (they're
  implicit from the screen the user came from, but not restated). Cheap copy addition —
  `route.params` would need `category` passed alongside the existing `scheduledDate`/
  `quotedPrice`, from `BookingDetailsScreen`'s `handleCancel`.
- Warning icon, penalty card, radio-style reason list, sticky confirm/keep buttons all
  already match the mock precisely, including the 48h/25%-vs-50% tiered-fee logic.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 18. DisputeFlowScreen

- **Mock label:** Dispute Flow — step 1 · **Target file:** `mobile/src/screens/flows/DisputeFlowScreen.js`

**Gap list**
- **[P1]** Mock's step 1 includes a trust-building reassurance line the current step 1
  lacks entirely: *"Payment can be held in escrow while we investigate. Most disputes
  resolve within 48 hours."* This is exactly the kind of differentiator copy the product
  vision calls "the moat" (escrow protection, dispute resolution) and it's currently
  invisible at the one moment a user is anxious enough to need it. Add as a small
  `Surface background="alt"` note under the issue-type list, same visual language as
  `CancellationFlowScreen`'s `penaltyTip`. Pure copy addition, no backend dependency.
- Everything else — 3-step progress bar, issue-type radio list, description step with
  live char-count + min-length validation, photo-attachment step (correctly labeled "not
  yet available" rather than faked) — already matches or exceeds the mock (mock only shows
  step 1; current's steps 2–3 are additive, not shown in the mock at all).

**Token needs:** None.
**Mock-data callouts:** None.

---

## 19. InvoiceScreen

- **Mock label:** Invoice · **Target file:** `mobile/src/screens/shared/InvoiceScreen.js`

**Gap list**
- None. Mock shows a simple receipt summary; current implementation is more complete
  (delivered-by employee line, license-verification status, payment processor ref,
  itemized line items, "Download PDF" with token-authenticated URL). Exceeds the mock.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 20. SettingsScreen

- **Mock label:** Settings · **Target file:** `mobile/src/screens/shared/SettingsScreen.js`

**Gap list**
- None of substance. Mock's ACCOUNT / LEGAL & DATA / SUPPORT groupings, row set (Edit
  profile, Language, Notifications, Privacy Policy, Terms of Service, Export my data,
  Delete my account, Help & FAQ, Sign Out, version footer) are all present and match.
  Current additionally has a "Contact us" row the mock doesn't show — harmless addition.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 21. PrivacyPolicyScreen

- **Mock label:** Privacy Policy · **Target file:** `mobile/src/screens/profile/PrivacyPolicyScreen.js`

**Gap list**
- **[P1]** Mock has a dedicated **"3. Location"** section explaining location is only used
  while the app is open, for nearby-pro matching, and is revocable in system settings at
  any time. Current's 3-section policy (Information We Collect / How We Use It / Your
  Rights & Retention) never separately addresses location permission — it's implied inside
  "Information We Collect" but not called out as its own transparent, scannable section.
  Given SwingBy's whole pitch is trust, and location is one of the more sensitive
  permissions the app requests, this is worth its own section — cheap copy addition
  (a 4th `SECTIONS` entry), no functional change.
- Content coverage is otherwise equivalent or greater than the mock's 4-section outline
  (current merges mock's "4. Deletion & retention" into its "3. Your Rights & Data
  Retention" section — same information, different grouping, not a gap).

**Token needs:** None.
**Mock-data callouts:** None.

---

## 22. OnboardingScreen

- **Mock label:** Onboarding · **Target file:** `mobile/src/screens/onboarding/OnboardingScreen.js`

**Gap list**
- **[P2]** Mock shows a single static frame: headline *"Local help, on demand"* /
  subtitle *"Post a job once and let verified local businesses come to you with quotes."*
  Current is a 3-slide swipeable carousel with different copy per slide ("Find trusted
  professionals," "Post a job, get quotes," "Book with confidence") — a richer pattern
  than one static mock frame can fully represent, and arguably a stronger onboarding
  sequence (search → post → book, mirroring the actual product flow). Not a structural
  gap. If copy parity with the mock's specific line is wanted, it could replace or become
  a 4th slide — low priority, current copy is not wrong.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 23. LoginScreen

- **Mock label:** Login · **Target file:** `mobile/src/screens/auth/LoginScreen.js`

**Gap list**
- **[P2]** Mock's brand mark is the literal wordmark **"SwingBy"**; current renders a
  single large stylized **"S"** instead. Both are valid brand treatments (compact mark vs.
  full wordmark) — flag for a branding-consistency decision, not an error.
- **[P2]** Mock's social buttons read *"Continue with Apple"* and (with what reads as a
  Google "G" glyph) *"Continue with Google."* Current renders both as plain text with no
  brand glyph, and both are `disabled` (opacity 0.5) because social auth isn't wired on
  the backend. Correctly non-functional for now; when/if Apple/Google Sign-In ships,
  add the proper brand marks per each platform's own logo guidelines (not a token from
  this system).
- Hero, email/password fields with inline error states, "Forgot password?" link, and the
  "New to SwingBy? Sign up" footer all match.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 24. SignupScreen

- **Mock label:** Signup · **Target file:** `mobile/src/screens/auth/SignupScreen.js`

**Gap list**
- **[P2]** **Information-architecture difference, not a visual bug:** the mock puts the
  **role choice first** — two large icon-forward cards ("I need help / Book local
  services" vs. "I run a business / Get jobs & clients") shown *before* any form fields.
  Current is a 3-step wizard that asks for role **last** (step 3, after email, then
  password+names), using a plain text `Tabs` control ("Find Services" / "Offer Services")
  rather than icon cards. Reordering to role-first is a real UX/flow change (bigger than a
  polish pass — it changes what step 1 asks for) — flag to mobile-agent as a flow decision,
  not a drop-in patch.
- **[P1]** Independent of step ordering, the **visual treatment** of the role choice
  itself is a cheap, self-contained win regardless of where it lands in the flow: replace
  the current plain-text `Tabs` control with two selectable icon-forward cards matching
  the mock's copy pattern ("I need help — Book local services" / "I run a business — Get
  jobs & clients"), reusing `Surface` + `Feather` icons + `Chip`-style selected-state
  border (`colors.accent` border when selected, `colors.border` otherwise) — no new
  components required, no step reordering required.
- Step-dot progress indicator, password strength hint, per-field inline errors, and the
  email-confirmation success state all already work well and aren't shown in the mock's
  single static frame (mock only depicts the fields, not the multi-step mechanics).

**Token needs:** None.
**Mock-data callouts:** None.

---

## 25. ForgotPasswordScreen

- **Mock label:** Forgot Password · **Target file:** `mobile/src/screens/auth/ForgotPasswordScreen.js`

**Gap list**
- **[P2]** Mock headline: *"Reset your password."* Current: *"Forgot password?"* Same
  intent, different phrasing — copy-only, no action required unless exact parity is wanted.
- Everything else (email field, "Send reset link," success state with checkmark + "try
  again" inline retry, "Back to login" footer) matches the mock precisely.

**Token needs:** None.
**Mock-data callouts:** None.

---

## 26. JobManagementScreen — ⚠ mock/target mismatch, needs product clarification

- **Mock label:** Job Management · **Target file:** `mobile/src/screens/business/JobManagementScreen.js`

**Gap list**
- **[P1]** — flag before building anything here. The mock's "Job Management" frame shows
  a **lead-triage / jobs-feed screen**: a "Jobs" header with a segmented filter (New (3) /
  Quoted / Scheduled) and a scrollable list of incoming `NEW REQUEST` cards (job title,
  neighborhood + distance + timing, a snippet of the client's description, "Send quote" /
  "Pass" actions). **The current `JobManagementScreen.js` is a completely different
  screen**: it's a single-booking detail/status manager (Details/Status tabs, opened with
  a specific `bookingId`, showing client info, employee assignment, and Live Job Status
  actions for *one already-accepted* booking). These are not the same screen re-skinned —
  they serve different points in the funnel (browsing new leads to quote on, vs. managing
  a job you already won).
  The lead-triage UI the mock actually depicts (`JobOpportunityCard` + `SendQuoteSheet`,
  with "Send quote"/"Pass" actions) **already exists and is already polished** — it lives
  in `business/DashboardScreen.js` (confirmed via `grep`), which the handoff README
  explicitly says was polished in a prior pass and is excluded from this atlas ("Home, My
  Jobs, Active Booking and Dashboard already live in SwingBy Polish"). So there are two
  plausible explanations, and this needs a product call rather than a guess:
  1. The mock's screen label is simply inaccurate/stale — the "Jobs" tab content it's
     depicting is `DashboardScreen`'s existing lead feed, and `JobManagementScreen.js`
     (the per-booking detail screen) needs no changes at all against this mock.
  2. The mock intends a genuinely separate business-side **"Jobs" tab list screen**
     (parallel to the client's `MyJobsScreen`) — a scrollable list of *all* the business's
     bookings grouped by status (New/Quoted/Scheduled/Completed), distinct from both
     `DashboardScreen`'s lead feed and `JobManagementScreen`'s single-booking detail — and
     that screen doesn't exist yet under any current file.
  Do not build either interpretation without confirming which one is intended — the two
  outcomes are very different amounts of work (zero vs. a new list screen).

**Token needs:** N/A until scope is confirmed.
**Mock-data callouts:** N/A until scope is confirmed.

---

## 27. EarningsScreen

- **Mock label:** Earnings · **Target file:** `mobile/src/screens/business/EarningsScreen.js`

**Gap list**
- **[P1]** Mock's primary metaphor is an **"Available balance"** ($2,418.50 + "$684
  pending clearance") with a **"Withdraw to TD •••• 8841"** CTA — a wallet-with-payout
  mental model. Current's hero is a **period-earnings total** ("$8.4k this month") with
  range-selector chips (week/month/3mo/YTD) — a earnings-report mental model. Both are
  legitimate, but they're different products conceptually. The "Withdraw" CTA implies
  Stripe Connect payouts, which — per the schema check for entry #10 — don't exist in this
  codebase yet. This is a payments-infrastructure dependency, not fixable by a UI change
  alone; flag to backend-agent. Until payouts exist, keep the current earnings-report
  framing (it's honest about what the app can actually do today) rather than showing a
  "Withdraw" button that goes nowhere.
- **[P1]** Mock shows an itemized **"RECENT PAYOUTS"** list — one row per job (description,
  date, amount, "paid out" vs. "clears {date}" status). Current shows an aggregate 2×2
  stat grid (Avg Job Value / Completed Jobs / Pending Payouts / Platform Fees) instead of
  any itemized list. This is a **cheap, high-value win**: the `payments` array is already
  fully fetched (`api.get('/payments/mine')`) and already has everything needed
  per-row (`released_to_business`, `status`, `bookings` join for description/date) — it's
  just being aggregated into stat cards instead of also being rendered as a list. Add a
  "Recent Payouts" section below the stats grid, reusing `InvoiceRow`'s visual pattern
  from `BusinessInvoicesScreen` (avatar/description + date, amount + status pill).
- **[P2]** Chart is an explicit stub (`EarningsChart`'s own top-of-file comment: victory-
  native needs Skia + reanimated@4, which conflicts with the current Expo SDK 54 pin).
  This is known, self-documented technical debt, not a fresh design finding — the current
  bar-fallback is a reasonable placeholder. No design action until the dependency
  conflict is resolved by mobile-agent/infra.

**Token needs:** None.
**Mock-data callouts:** None (payouts data is real, just underused).

---

## 28. BusinessAnalyticsScreen

- **Mock label:** Business Analytics · **Target file:** `mobile/src/screens/business/BusinessAnalyticsScreen.js`

**Gap list**
- **[P2]** Mock's hero is a **"Jobs per week"** trend chart with a **"↑18%"** delta.
  Current's hero is **average rating** (a static value, no trend). Different primary KPI
  choice — not wrong (rating-first is defensible for a trust-first product), but worth a
  product/IA conversation rather than a blind copy of the mock. Not urgent.
- **[P2]** Mock shows **trend deltas** on every metric ("↑6 pts," "↓4 min," "↑5 pts")
  comparing to a prior period. Current's `MetricCard` renders only the current value, no
  comparison. `/businesses/me/analytics` doesn't return any prior-period baseline today
  (confirmed against the fields the screen consumes: `avg_rating`, `review_count`,
  `total_bookings`, `total_earnings`, `profile_views`, `conversion_rate`, `repeat_rate` —
  no `_previous` or `_delta` variants). Needs backend to compute and return period-over-
  period deltas before this can be built; use the `TrendDelta` component flagged in the
  cross-screen findings once that data exists.
- **[P2]** Mock shows an **"AVG RESPONSE"** metric ("14 min," "↓4 min") — current has no
  response-time metric anywhere in the analytics payload. Needs a new backend-computed
  field (median time between post creation and this business's interest). Same dependency
  as the "responds in ~X min" gap flagged in Quote Comparison (#4) — one backend metric,
  two UI consumers.
- Category breakdown chart ("Most Requested," current) vs. mock's "Top services" (percent-
  share framing) are conceptually equivalent — count-based bars vs. percent-based bars,
  low-priority framing difference only.

**Token needs:** None (once backend delta data exists, `TrendDelta` reuses
`colors.success`/`colors.danger`, no new tokens).
**Mock-data callouts:** None — do not fake trend deltas or response times client-side;
both are exactly the kind of "trust the numbers" claims this product can't afford to
fabricate.

---

## 29. BusinessInvoicesScreen

- **Mock label:** Business Invoices · **Target file:** `mobile/src/screens/business/BusinessInvoicesScreen.js`

**Gap list**
- **[P1]** Mock has **filter tabs** (All / Paid / Pending / Overdue) above the list.
  Current has none — it always shows the full filtered set (completed bookings + any with
  money movement) with no way to narrow by payment state. "All" and "Paid" are trivially
  buildable client-side today (filter the already-fetched `invoices` array by
  `payment_status`). Add a `Chip` row, same pattern as `JobManagementScreen`'s status
  filters.
- **[P2]** "Pending" and **"Overdue"** as filter values expose a data-model gap: the
  current `payment_status` enum (`held` / `partial_released` / `fully_released` /
  `refunded`, per `BookingDetailsScreen`'s `paymentPillStyle`) has no `overdue` concept at
  all — "overdue" requires a due-date-vs-now comparison that doesn't exist anywhere in the
  schema. "Pending" can be approximated from `held`/`partial_released`, but "Overdue" is a
  genuinely new business-logic concept (needs a due date field + a computed status). Flag
  to backend-agent/database-agent; don't invent an "Overdue" filter tab that has nothing
  real to filter by.
- **[P1]** Mock shows an **"Outstanding $545.00"** total footer (sum of unpaid invoices).
  Once "Pending" is filterable (see above), this total is a one-line client-side sum —
  cheap to add alongside the filter tabs, no new backend dependency for the *paid vs.
  pending* subset (only the *overdue* subset needs new backend data).
- **[P2]** Mock shows the **invoice number** (e.g. "INV-2481") inline on each row. Current
  `InvoiceRow` shows client name + category + date instead — the invoice number does exist
  server-side (the dedicated `InvoiceScreen` fetches `invoice_number` from
  `/bookings/{id}/invoice`), so it's available, just not surfaced on this list row. Small
  addition once the filter/total work above is done.

**Token needs:** None.
**Mock-data callouts:** None (all real-data gaps, no presence/mock-service involvement).

---

## 30. EmployeeManagementScreen

- **Mock label:** Employee Management · **Target file:** `mobile/src/screens/business/EmployeeManagementScreen.js`

**Gap list**
- **[P1]** Mock's employee rows show **rating + job count + a live status label** ("★4.9 ·
  148 jobs · on a job now" / "★4.8 · 92 jobs · available" / "★4.7 · 64 jobs · off today").
  Current `EmployeeRow` shows only name + role title + an active/inactive `Switch` — no
  rating, no job count, no live status at all. Rating and job count are already fetched
  and rendered elsewhere for the same employee entities (`EmployeeProfileScreen` reads
  `avg_rating`/`jobs_completed` from `/employees/{id}/profile`) — if `/employees/` (the
  list endpoint this screen calls) doesn't already return those fields per-row, that's a
  small backend addition to bring the list endpoint's shape in line with the detail
  endpoint's. The "on a job now / available / off today" status is presence-shaped data
  that doesn't exist anywhere (no shift/schedule table) — route that specific piece
  through `mockPresence.js` (see below); it can derive a rough "on a job now" from whether
  the employee has an `in_progress` booking assigned *today* (real data, computable), but
  "available" vs. "off today" needs a working-hours concept that doesn't exist yet
  (same gap flagged for `BusinessProfileScreen`'s owner view, #10) — mock that specific
  distinction until working hours ships.
- **[P1]** Mock has a **"TODAY'S ASSIGNMENTS"** section (time-slotted list: "9:00 Deep
  clean — Kensington → Marcus J.," "13:30 Office clean — Beltline → Tina W."). Nothing
  like this exists in the current screen at all. This is buildable now from real data —
  today's bookings already have `scheduled_date`/`confirmed_date` and `employee_id` — a
  simple query (bookings for this business, `scheduled_date` = today, sorted by time) and
  a small list section reusing `ListItem`. High-value, no backend dependency, worth
  prioritizing.
- **[P2]** Mock shows a **pending-invite row** with tracked state ("jenna@bowriver.ca ·
  Invite sent · 2 days ago · Resend"). Current's invite mechanism is a raw deep-link
  string, copied to clipboard, with zero persistence or tracking of who's been invited or
  when — there's no way to show this row because there's no data behind it. Needs a
  backend `employee_invites` concept (email, sent_at, status) before the UI can render
  it. Flag to backend-agent; the current copy-link flow is a reasonable interim.

**Token needs:** None (status dot reuses `colors.success`/`colors.accent`/
`colors.textTertiary` per the three-state mapping: available/on-a-job/off).
**Mock-data callouts:** "on a job now / available / off today" (the `available` vs.
`off today` distinction specifically) — route through `mockPresence.js`.

---

## 31. BusinessSetupScreen

- **Mock label:** Business Setup · **Target file:** `mobile/src/screens/onboarding/BusinessSetupScreen.js`

**Gap list**
- **[P2]** Mock shows a clean **multi-step wizard** ("Step 2 of 4," one question per
  screen: "What services do you offer?" with Back/Continue). Current is a **single-screen
  form** with every field stacked (name → category → description → address → radius →
  submit), no step indicator. `PostJobScreen.js` already has a working, polished 4-step
  wizard pattern (`StepPanel`, `ProgressBar`, `StepLabels`) in this same codebase — this
  screen could reuse that exact pattern for consistency. Real UX improvement, but a
  bigger lift than a token/copy fix (needs the form logic split into steps with
  validation-per-step) — flag to mobile-agent as a worthwhile but non-trivial refactor,
  not a quick pass.
- **[P2]** Mock's step frame is titled **"What services do you offer?"** with a **multi-
  select** chip grid (implying a business can pick more than one category) and the
  reassurance *"Pick everything that applies — you can change this anytime."* Current's
  category picker is **single-select** (`Chip selected={category === cat}`), consistent
  with `businesses.category` being a single string field in the schema (confirmed:
  `BusinessCreate`/`BusinessUpdate` in `backend/app/api/businesses.py` have one `category:
  str` field, not a list). If multi-category businesses are actually wanted, that's a
  schema change (`category` → `categories: list[str]` or a join table), not a UI fix —
  flag to backend-agent/database-agent as a product decision before touching this screen's
  picker.

**Token needs:** None.
**Mock-data callouts:** None (both gaps are backend/schema-gated, not presence-shaped).

---

## New mock-data service: `mobile/src/services/mockPresence.js`

Three screens (Message Thread #12, Employee Management #30, and implicitly any future
chat-adjacent screen) need presence-shaped data the backend doesn't provide: online/offline
status, read receipts, and "on shift" status. Per the handoff README's rule, this must be
a clearly-marked mock boundary, not fake data scattered inline. Proposed shape:

```js
// mobile/src/services/mockPresence.js
// MOCK BOUNDARY — no backend support for presence/read-receipts/shift-status yet.
// Every export here is a stand-in so screens can match the design now. When the
// backend ships real presence (websocket/polling) or shift scheduling, delete this
// file and swap call sites to the real service — grep-friendly on `mockPresence`.

// Returns a deterministic-but-fake online status for a counterpart in a chat thread.
// Deterministic (hashed from id) so it doesn't flicker between renders/reloads.
export function getMockOnlineStatus(userOrBusinessId) { /* returns boolean */ }

// Returns a fake "read at" timestamp for a sent message, or null if unread.
// Deterministic per message id, only ever applied to the current user's own
// outgoing messages (never fabricates the other party's read state as a lie about
// something the current user could disprove by asking them).
export function getMockReadReceipt(messageId, sentAt) { /* returns ISO string | null */ }

// Returns one of 'on_job' | 'available' | 'off_shift' for an employee row.
// 'on_job' is derived from REAL data where possible (an in_progress booking assigned
// to this employee today) — only 'available' vs 'off_shift' is mocked, since working
// hours don't exist in the schema yet.
export function getMockShiftStatus(employee, todaysBookings) { /* ... */ }
```

Every call site must import from this file by name (not inline `Math.random()` or
hardcoded `true`) so a future removal is a clean grep-and-delete, and so code review can
spot at a glance which UI is presence-mocked vs. real.

---

## Summary table

| # | Screen | Target file | P0 | P1 | P2 |
|---|---|---|---|---|---|
| 1 | MessagesScreen | `messages/MessagesScreen.js` | 0 | 0 | 1† |
| 2 | ProfileScreen | `profile/ProfileScreen.js` | 0 | 0 | 2 |
| 3 | PostJobScreen | `client/PostJobScreen.js` | 0 | 1 | 2† |
| 4 | QuoteComparisonScreen | `client/QuoteComparisonScreen.js` | 0 | 4 | 1 |
| 5 | BookingDetailsScreen | `client/BookingDetailsScreen.js` | 0 | 0 | 0 |
| 6 | ReviewScreen | `client/ReviewScreen.js` | 0 | 1 | 2 |
| 7 | SearchScreen | `client/SearchScreen.js` | 0 | 1 | 1 |
| 8 | NearbyMapScreen | `client/NearbyMapScreen.js` | 0 | 1 | 1 |
| 9 | FavoritesScreen | `client/FavoritesScreen.js` | 0 | 2 | 1 |
| 10 | BusinessProfileScreen (public + owner) | `business/BusinessProfileScreen.js` | 0 | 2 | 4 |
| 11 | EmployeeProfileScreen | `business/EmployeeProfileScreen.js` | 1 | 0 | 0 |
| 12 | MessageThreadScreen | `messages/MessageThreadScreen.js` | 0 | 2 | 1 |
| 13 | NotificationsCenterScreen | `profile/NotificationsCenterScreen.js` | 0 | 1 | 1 |
| 14 | ProfileEditScreen | `profile/ProfileEditScreen.js` | 0 | 0 | 1 |
| 15 | PaymentMethodScreen | `profile/PaymentMethodScreen.js` | 0 | 0 | 1 |
| 16 | ReferralScreen | `profile/ReferralScreen.js` | 1 | 1 | 1 |
| 17 | CancellationFlowScreen | `flows/CancellationFlowScreen.js` | 0 | 0 | 1 |
| 18 | DisputeFlowScreen | `flows/DisputeFlowScreen.js` | 0 | 1 | 0 |
| 19 | InvoiceScreen | `shared/InvoiceScreen.js` | 0 | 0 | 0 |
| 20 | SettingsScreen | `shared/SettingsScreen.js` | 0 | 0 | 0 |
| 21 | PrivacyPolicyScreen | `profile/PrivacyPolicyScreen.js` | 0 | 1 | 0 |
| 22 | OnboardingScreen | `onboarding/OnboardingScreen.js` | 0 | 0 | 1 |
| 23 | LoginScreen | `auth/LoginScreen.js` | 0 | 0 | 2 |
| 24 | SignupScreen | `auth/SignupScreen.js` | 0 | 1 | 1 |
| 25 | ForgotPasswordScreen | `auth/ForgotPasswordScreen.js` | 0 | 0 | 1 |
| 26 | JobManagementScreen | `business/JobManagementScreen.js` | 0 | 1‡ | 0 |
| 27 | EarningsScreen | `business/EarningsScreen.js` | 0 | 2 | 1 |
| 28 | BusinessAnalyticsScreen | `business/BusinessAnalyticsScreen.js` | 0 | 0 | 3 |
| 29 | BusinessInvoicesScreen | `business/BusinessInvoicesScreen.js` | 0 | 2 | 2 |
| 30 | EmployeeManagementScreen | `business/EmployeeManagementScreen.js` | 0 | 2 | 1 |
| 31 | BusinessSetupScreen | `onboarding/BusinessSetupScreen.js` | 0 | 0 | 2 |
| | **Totals** | | **2** | **26** | **35** |

† Row 1's one tagged note and row 3's second `[P2]` note are explicitly "not a gap, keep
it" observations (the current implementation already exceeds or matches the mock) —
counted in the section text for completeness but not real work items, so they're excluded
from these totals. Every other count below is a real, actionable item.
‡ JobManagementScreen's P1 is a clarification flag, not a build item — see entry #26.

**Grand total: 2 P0 · 26 P1 · 35 P2 · 63 tagged items across 31 screens** (61 of which are
real actionable work; 2 are "already matches/exceeds the mock, no action" notes called out
above for transparency).

## Recommended implementation order

**Wave 0 — P0s first (both are quick, both are user-trust-damaging as-is):**
1. EmployeeProfileScreen (#11) — replace the "coming soon" placeholder sentence with an
   honest empty state; separately flag the `reviewee_type` backend gap.
2. ReferralScreen (#16) — stop showing hardcoded fake `0`/`$0` stats; hide or relabel as
   illustrative until backend referral tracking exists.

**Wave 1 — shared-component fixes (unlocks P1s on 5+ screens at once):**
3. `NearbyCard` — add `verified` + `category` props (unlocks #7 Search, #9 Favorites,
   contributes to #8 Nearby Map's data model).
4. `TextField` — add `maxLength` + counter rendering (unlocks #3 PostJobScreen, reusable
   everywhere else a counter is wanted later).
5. Shared `ProgressBar` component (unlocks #10 owner-view completeness meter; also
   de-duplicates 3 existing hand-rolled copies).

**Wave 2 — client-side-only P1s, real data already available, no backend wait:**
6. QuoteComparisonScreen (#4) — Verified badge, "Recommended" copy, chat-timing disclaimer
   (message bubble + response-time stay blocked on backend, see Wave 4).
7. Nearby Map (#8) — location/radius overlay pill.
8. Message Thread (#12) — job-context strip + "View" link (presence pieces → Wave 3).
9. Notifications Center (#13) — TODAY/EARLIER grouping.
10. Privacy Policy (#21) — Location section.
11. Earnings (#27) — Recent Payouts itemized list (data already fetched).
12. Business Invoices (#29) — filter tabs (All/Paid) + Outstanding total for the paid/
    pending subset (Overdue stays blocked, see Wave 4).
13. Employee Management (#30) — Today's Assignments section (real data).
14. Cancellation Flow (#17), Dispute Flow (#18) copy additions.
15. BusinessProfileScreen public view (#10) — jobs-done + distance stat row.

**Wave 3 — mockPresence.js + its consumers:**
16. Build `mobile/src/services/mockPresence.js` per the contract above.
17. Wire Message Thread (#12) online status + read receipts.
18. Wire Employee Management (#30) available/off-shift distinction (on-job stays real-data).

**Wave 4 — needs backend/database-agent first, do not start mobile work until landed:**
19. `interests.message` field (unblocks Quote Comparison's quote bubble).
20. Response-time aggregation (unblocks Quote Comparison + Business Analytics).
21. `reviewee_type: employee` support (unblocks EmployeeProfileScreen's real fix, beyond
    the Wave 0 stopgap).
22. Referral tracking backend (unblocks Referral's real stats + readable codes, beyond the
    Wave 0 stopgap).
23. Business services-with-pricing schema, working hours, Stripe Connect payout status
    (unblocks BusinessProfileScreen owner-view #10, Earnings' "Withdraw" CTA #27).
24. Overdue invoice concept (unblocks Business Invoices #29's third filter tab).
25. Employee-invite tracking (unblocks Employee Management #30's pending-invite row).
26. Analytics period-over-period deltas (unblocks Business Analytics #28's trend arrows).

**Needs a product decision before any implementation:**
27. JobManagementScreen (#26) — confirm mock/target mismatch interpretation.
28. SignupScreen (#24) — confirm whether role-selection should move to step 1.
29. BusinessSetupScreen (#31) — confirm single- vs. multi-category businesses, and whether
    to convert to a stepped wizard.
