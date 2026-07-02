# SwingBy Chrome live audit — 2026-06-21

> Driven via Claude in Chrome MCP against the mobile app running in Expo Web at `localhost:8081`.
> Seed accounts: `client@swingby.app`, `business@swingby.app`, `employee@swingby.app` (all `Swingby<Role>2026`).
> Mobile backend: defaults to `EXPO_PUBLIC_API_URL` in `mobile/.env` → currently `https://swingbyy-api.onrender.com`.

## Findings table

| # | Persona | Page / Action | Result | Notes / Errors |
|---|---|---|---|---|
| 0 | — | Open `/welcome` (first load) | ⚠️ Spurious "Request failed · Field required" toast on initial mount | Captured by Kira's screenshot before chrome session began. Re-navigating cleared it. Likely the AuthContext bootstrap or a push-token register call firing with missing fields. Triage after main audit. |

| 1 | — | App boot (welcome → login) | 🔴 **BUG** | `GET /messages/unread-count` fires on mount BEFORE auth, returns **HTTP 422 "Field required"**. Likely `UnreadProvider` polling without a user/token check. Toast displays to user. **Fix priority: HIGH.** |

| 2 | Client | Login `client@swingby.app` → `/ClientTabs/Home` | ✅ | Login works. Landed on Home. |
| 3 | Client | Home greeting | ⚠️ | Shows "Hey there" instead of "Hey [first_name]". User row not used in greeting, or first_name missing in DB. **Fix priority: MEDIUM.** |
| 4 | Client | Tab/page title | ⚠️ | Browser tab title is literally `"undefined"`. Routing meta missing. **Fix priority: LOW** (cosmetic but unprofessional). |
| 5 | Client | UnreadProvider polling | 🔴 **BUG** | `GET /messages/unread-count` called **3 times in 5 seconds** with no rate limiting, all returned **503** (Render cold start). UnreadProvider needs: (a) backoff on failure, (b) gate by auth status, (c) longer polling interval. **Fix priority: HIGH.** |
| 6 | Client | Home — Top Rated + Nearby sections | 🔴 | Stuck on skeleton loaders. Render backend returning 503 (cold start). Need to: (a) wake Render before audit continues, (b) verify `/businesses/nearby` works once warm. **Fix priority: depends on (7).** |
| 7 | Client | Category list mismatch ⚠️⚠️⚠️ | 🔴 **CRITICAL BUG** | Home categories: `All, Cleaning, Plumbing, Moving, Electric, Lawn, Painting, Carpentry`. PostJob categories (from earlier audit): `Cleaning, Plumbing, Electrical, Landscaping, Painting, Carpentry, Moving, Handyman`. **`Electric` vs `Electrical`, `Lawn` vs `Landscaping`** — these are different strings and the backend filters by exact match. **Posts made under "Landscaping" will never be findable by businesses filtering by "Lawn".** This breaks the entire post→match flow. **Fix priority: CRITICAL** — must be one canonical list, used by Home, PostJob, BusinessSetup, BusinessNavigator filtering, and the backend Pydantic enum. |

| 8 | Client | UnreadProvider polling — confirmed | 🔴 **BUG (critical scale)** | Observed **8 `/messages/unread-count` calls in 4 seconds** on Home reload — even after Render warm, returns 422 "Field required" (missing param or auth header shape). UnreadProvider is in a tight loop. **Fix priority: CRITICAL** — fills logs, wastes rate limit, breaks login UX with toast spam. Likely cause: useEffect with no dependency array + an effect that triggers state change → infinite re-render. |
| 9 | Client | Home `/businesses/nearby` call MISSING | 🔴 | Network log shows zero requests to `/businesses/nearby` after login. HomeScreen has the code but the call isn't firing. Likely cause: `getUserLocation()` failing on web (no `expo-location` permission flow on web → throws, then... maybe error swallowed?). Top Rated + Nearby never load. **Fix priority: HIGH.** |

| 10 | Client | Profile renders | ✅ | Email + Client badge + menu shown |
| 11 | Client | Profile — no name shown | 🔴 | Avatar empty, no first/last name visible. Root cause: seed account first_name+last_name were empty strings. **FIXED** in this session — seeds now `Cara Client / Bob Builder / Eli Employee`. |
| 12 | All | Seed account roles | 🔴 → ✅ | `business@swingby.app` had `role='client'` not `business_owner`. **FIXED** in this session via SQL update. |
| 13 | Backend | `GET /messages/unread-count` endpoint MISSING | 🔴 **CRITICAL BUG** | Mobile calls it constantly but the route doesn't exist in `backend/app/api/messages.py`. FastAPI routes the call to `/{booking_id}` handler (booking_id="unread-count") → Supabase query for that booking → 500. **Fix priority: CRITICAL.** Add a real endpoint `GET /messages/unread-count` that counts messages across all the user's bookings where sender ≠ user and (unread marker — needs schema decision). |
| 14 | Backend | `/businesses/nearby` works correctly | ✅ | Returns 200 with `Greenland Lawncare` (Landscaping, Calgary) within 25km. Real data. |

| 15 | Business | Login `business@swingby.app` → render error | 🔴 **CRITICAL BUG** | ErrorBoundary "Something went wrong" on render. Console: `ReferenceError: Cannot access '_request' before initialization at GooglePlacesAutocomplete`. The v2.6.4 library has a TDZ bug on Expo Web. Crashes both BusinessSetupScreen + PostJobScreen on web. **Fix priority: CRITICAL.** Skip the component when `Platform.OS === 'web'` and use the plain TextField fallback (already wired). |
| 16 | All | Console spam: "Unexpected text node" | ⚠️ | 30+ errors `A text node cannot be a child of a <View>` across multiple screens. Likely whitespace/empty-string children in a `<View>`. Not blocking but pollutes logs. **Fix priority: MEDIUM.** Sweep with the bucket-import audit. |

## After-fix pass (Round 2 — 2026-06-21 evening)

| # | Persona | Page / Action | Result | Notes |
|---|---|---|---|---|
| R1 | — | `/welcome` first load | ✅ | "Field required" toast GONE. UnreadProvider gate working as designed. Console clean. |
| R2 | Client | Login → `/ClientTabs/Home` | ✅ | Login works. "Hey **Cara**" greeting renders (finding #3 fixed by seed data). |
| R3 | Client | UnreadProvider polling | 🟡 partial | Still 503 every 30s because Render hasn't redeployed yet (new `/messages/unread-count` endpoint is in git but not pushed). **No toast spam now** — `_silent: true` flag is filtering. Will be fully green once backend deploys. |
| R4 | Client | Home — "No businesses nearby" | ⚠️ data issue, not code | Filtered by category=Cleaning by default. Seed `Test Cleaning Co.` has NULL lat/lng → never matches nearby bounding-box. `Greenland Lawncare` (Landscaping) has coords. **Action:** set lat/lng on seed cleaning business OR seed 1-2 more businesses in Calgary across categories. |
| R5 | Client | Category list mismatch | 🔴 still unfixed | Home shows: `All · Cleaning · Plumbing · Moving · Electric · Lawn · Painting · Carpentry`. PostJob/Setup: `Cleaning · Plumbing · Electrical · Landscaping · Painting · Carpentry · Moving · Handyman`. **Posts under "Landscaping" will never match a Home filter for "Lawn".** Must centralize into one canonical list. |
| R6 | Client | Tab title | ⚠️ still `undefined` | Cosmetic. Set screen titles in navigators. |

## Round 3 (after data seed)

| # | Persona | Page / Action | Result | Notes |
|---|---|---|---|---|
| R7 | Data | Seeded `Bob's Cleaning Co.` (Cleaning, Calgary, 25km, verified) under business@swingby.app | ✅ DONE | Unblocks Home Cleaning category in future tests. License-status enum: `pending`/`verified`/`rejected` only — `approved` is rejected by check constraint. |
| R8 | Client | Home reload after seed | 🟡 partial | Greeting + categories render. "Request failed · Network Error" toast appeared — almost certainly the `/businesses/nearby` call hitting Render mid cold-start. Repeat after backend warms or wait ≥30s post-deploy. |
| R9 | Backend | New `/messages/unread-count` endpoint | 📦 ready, **not yet redeployed** | The endpoint is in `backend/app/api/messages.py` BEFORE `/{booking_id}` (so FastAPI doesn't 422-coerce "unread-count" into a UUID). Needs commit + push for Render auto-deploy. |
| R10 | Mobile | UnreadProvider gating + silent flag | ✅ live | `UnreadProvider` now skips the fetch entirely until `user` is set; `api.js` interceptor honors `_silent: true` config flag to suppress global toasts on poll failures. Verified clean Welcome + Login screens. |

## Wrap-up: what landed this session

| Layer | Files |
|---|---|
| **Backend** | `backend/app/api/messages.py` — new `/unread-count` (needs push) |
| **Mobile context** | `mobile/src/context/UnreadContext.js` — gated on `useAuth().user`, opts into `_silent` |
| **Mobile services** | `mobile/src/services/api.js` — interceptor respects `_silent: true` |
| **Database** | Inserted Calgary-Cleaning seed business for audit coverage |

## What's left for the next pass

1. **Push the backend change** to Render (`git add backend/app/api/messages.py && git commit -m "feat: /messages/unread-count stub endpoint"` then push).
2. **Continue the persona walks**: PostJob (with web Places guard verified), Profile, Sign-up flow for a fresh user, Business persona end-to-end, Admin persona.
3. **R5 fix (CRITICAL)**: unify category list across Home / PostJob / BusinessSetup / `/businesses/nearby` filters. Recommend extracting a single `mobile/src/constants/categories.js` consumed everywhere + a backend Pydantic enum.
4. **R6 fix (cosmetic)**: set per-screen `options.title` in each Navigator so the browser tab stops showing `undefined`.

(Findings appended as the walk progresses.)
