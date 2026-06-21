# Page completeness audit — web pre-launch + mobile
> Run date: 2026-06-20 · Brief: `AGENTS/BRIEF-auth-and-pages.md` task 5
> Scope: every route in `web/pre-launch/src/App.jsx` and every screen registered in `mobile/src/navigation/*`

## Method
- Cross-checked every `<Route>` in `App.jsx` against `web/pre-launch/src/pages/*.jsx` — every route resolves to a real file (no missing imports).
- Cross-checked every `<Stack.Screen>` in `AuthNavigator`, `ClientNavigator`, `BusinessNavigator` against `mobile/src/screens/*` — every screen resolves.
- Searched the source tree for `coming soon`, `placeholder`, `TODO`, `FIXME`, `lorem` (case-insensitive) and triaged each hit.

## Web pre-launch — route status

| Route | File | Status | Note |
|---|---|---|---|
| `/` | Home.jsx | ✅ | |
| `/how-it-works` | HowItWorks.jsx | ✅ | |
| `/for-clients` | ForClients.jsx | ✅ | `screenshotsPlaceholder` i18n key is intentional (mockup frame) |
| `/for-businesses` | ForBusinesses.jsx | ✅ | |
| `/pricing` | Pricing.jsx | ✅ | |
| `/categories`, `/categories/:slug` | CategoriesIndex, CategoryPage | ✅ | |
| `/cities`, `/cities/calgary` | CitiesIndex, CalgaryPage | ✅ | "More cities coming soon" is honest expansion-roadmap copy, not a placeholder |
| `/safety` | Safety.jsx | ✅ | |
| `/about`, `/press`, `/careers` | About, Press, Careers | ✅ | |
| `/contact` | Contact.jsx | ✅ FIXED | Form was a stub (`Placeholder: replace with real API call`). Wired to real `POST /contact` backend endpoint via Resend. |
| `/download` | Download.jsx | ✅ | "Coming soon" badge is accurate — app is in beta. App-store links go to public store pages as honest fallbacks. |
| `/help`, `/help/:slug` | HelpCenter, HelpArticle | ✅ | |
| `/blog`, `/blog/:slug` | BlogIndex, BlogPost | ✅ | |
| `/login` | Login.jsx | ✅ FIXED | Magic link now sends `emailRedirectTo: window.location.origin/auth/callback`. Apple/Google buttons disabled with honest "Soon" badge. |
| `/signup` | Signup.jsx | ✅ FIXED | Now sends `emailRedirectTo`. Post-signup routes to `/verify-email` (not dashboard) unless Supabase returns a confirmed session. |
| `/auth/callback` | AuthCallback.jsx | ✅ | |
| `/forgot-password` | ForgotPassword.jsx | ✅ | Already uses `window.location.origin/reset-password`. |
| `/reset-password` | ResetPassword.jsx | ✅ | |
| `/verify-email` | VerifyEmail.jsx | ✅ FIXED | Resend was broken (sent with `email: ''`). Now accepts email from router state or `?email=` and resends with the correct `emailRedirectTo`. |
| `/onboarding/client` | ClientOnboarding.jsx | ✅ | |
| `/onboarding/business/*` | BusinessOnboarding.jsx | ✅ FIXED | Payment step no longer says "Payment integration coming soon"; copy now reads as a normal "you can add a payout method later" step. |
| `/dashboard` | Dashboard.jsx | ✅ FIXED | Profile completeness now: (a) renders honest label `Confirm your email` + `Resend link` CTA when `email_confirmed_at` is null, and (b) adds inline actions on every pending item so the user has a next step. |
| `/bookings`, `/bookings/:id` | Bookings, BookingDetail | ✅ | |
| `/messages`, `/messages/:bookingId` | Messages, MessageThread | ✅ | |
| `/profile`, `/reviews`, `/favorites`, `/searches` | Profile, Reviews, Favorites, SavedSearches | ✅ | |
| `/payment-methods` | PaymentMethods.jsx | ⚠️ KNOWN GAP | Stripe is intentionally post-beta (STATUS.md H8). Page renders an honest placeholder. |
| `/account`, `/notifications`, `/privacy-settings` | AccountSettings, NotificationSettings, PrivacySettings | ✅ | |
| `/business/dashboard`, `/business/earnings`, `/business/employees`, `/business/services`, `/business/profile` | BusinessDashboard etc. | ✅ | |
| `/privacy`, `/terms`, `/cookies`, `/accessibility` | PrivacyPage, TermsPage, CookiesPage, AccessibilityPage | ✅ | |
| `/maintenance` | Maintenance.jsx | ✅ | Honest "we'll be right back" copy. |
| `/500` | ServerError.jsx | ✅ | |
| `*` (404) | NotFoundPage.jsx | ✅ | Professional copy. |

### Unused file
- `web/pre-launch/src/pages/ComingSoon.jsx` exists but is **not imported in App.jsx**. Safe to delete in a follow-up cleanup PR; left in place this pass to keep the audit non-destructive.

## Mobile — screen status

| Stack | Screen | File | Status | Note |
|---|---|---|---|---|
| Auth | Onboarding, Login, Signup, ForgotPassword | * | ✅ | |
| Client tabs | Home, MyJobs, Messages, Profile | * | ✅ | |
| Client stack | BusinessProfile, EmployeeProfile, ActiveBooking, QuoteComparison, PostJob, Chat, Review, Map, Notifications, Search, Favorites, NearbyMap, ProfileEdit, Settings, PrivacyPolicy, TermsOfService, HelpFAQ, ReferralScreen, NotificationsCenter, BookingDetails, MessageThread, CancellationFlow, PaymentMethod, DisputeFlow | * | ✅ | All registered, all files exist. |
| Business stack | BusinessAnalytics, BusinessProfile, Earnings, EmployeeManagement, JobManagement | * | ⚠️ partial | See known gaps below. |

### Known beta-scoped gaps (intentional, called out honestly in UI)
| Screen | Behavior | Why it's not a bug |
|---|---|---|
| PaymentMethodScreen | "Coming Soon" badge, "pay outside the app for now" footer | Stripe is post-beta — STATUS.md H8 |
| BusinessAnalyticsScreen | Empty state "Analytics coming soon" | Depends on `GET /businesses/me/analytics` backend endpoint (C5 in ORCHESTRATOR_ISSUES) |
| EarningsScreen | "Detailed chart coming soon", CSV export alert | Depends on same analytics endpoint |
| DisputeFlowScreen, ProfileEditScreen | Photo upload "coming soon" toasts | Image upload exists for jobs (PostJobScreen + `/uploads/image`); avatar upload not yet wired |

These are **transparent unfinished features** in beta scope, not stubs that lie about working. They are tracked in `memory/ORCHESTRATOR_ISSUES.md`.

## Auth-flow fixes shipped this pass (cross-cuts pages above)

| Fix | Location | Change |
|---|---|---|
| Email-verify honesty (Brief §1) | `web/pre-launch/src/pages/Dashboard.jsx` | Profile-completeness item now shows `Confirm your email` + `Resend link` CTA instead of a passive green check when `email_confirmed_at` is null. Other pending items gained inline action links. |
| Post-signup gate (Brief §1) | `web/pre-launch/src/pages/Signup.jsx` | Routes to `/verify-email` unless Supabase returned a confirmed session, so the user is not dropped into the dashboard before they click the link. |
| Cascade FK (Brief §2) | Supabase migration `users_id_fkey_cascade` | `public.users.id → auth.users(id) ON DELETE CASCADE` applied + verified via `pg_get_constraintdef`. |
| Redirect from prod origin (Brief §3) | `Signup.jsx`, `Login.jsx`, `VerifyEmail.jsx`, `ForgotPassword.jsx` | Every Supabase auth call uses `${window.location.origin}/...` — no hard-coded `localhost`. |
| Backend reset redirect (Brief §3/§4) | `backend/app/api/auth.py`, `backend/app/config.py` | `swingby://auth/reset` deep link replaced with `https://swingbyy.com/reset-password` (configurable via `PASSWORD_RESET_REDIRECT_URL`). Mobile users now land on a working web reset page. |
| Forgot-password wired end-to-end (Brief §4) | web + mobile | Web: `/forgot-password → email → /reset-password → /dashboard`. Mobile: `ForgotPasswordScreen → email → web reset page → return to app and log in`. No dead links. |

## Items that still require human action (out of scope for code agent — Brief calls these out as Kira-only)

- Supabase → Auth → enable **Confirm email** so the verify-email flow is enforced server-side.
- Supabase → Auth → URL Configuration → Site URL = `https://swingbyy.com`; redirect URLs = `https://swingbyy.com/**`, `swingby://**`.
- DNS: add **DMARC** record on `swingbyy.com` to stop welcome emails landing in spam.
