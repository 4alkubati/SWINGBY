# SwingBy — Screen Index (build map for Claude Code)

Every screen in the app, its source file, and what it must contain. Open the matching frame in **`SwingBy All Screens.dc.html`** (search the page for the **Screen label** in bold) as the pixel reference. All screens use the 2a "Jet × Pulse" system — tokens in `README.md`, craft rules in `POLISH-TIPS.md`.

Paths are relative to `mobile/src/screens/`. Adjust the prefix to match the real repo layout if it differs.

## Already specced in detail (README §Screens) — do these first
| Screen label | Source file |
|---|---|
| Client Home | `client/HomeScreen.js` |
| Active Booking | `client/ActiveBookingScreen.js` |
| Business Dashboard | `business/DashboardScreen.js` |

## Client — tabs
| Screen label | Source file | Must contain |
|---|---|---|
| Messages | `messages/MessagesScreen.js` | Search field, conversation rows (initials tile, name, preview, timestamp, unread purple count badge). Unread = white preview + purple badge; read = muted. |
| Profile | `profile/ProfileScreen.js` | Avatar + name + role, stat row, settings/list rows with Feather icons, sign-out. |

## Client — booking flow
| Screen label | Source file | Must contain |
|---|---|---|
| Post Job (step 2 — Details) | `client/PostJobScreen.js` | Multi-step header/progress, form fields (category, description, date, address), sticky primary CTA. |
| Quote Comparison | `client/QuoteComparisonScreen.js` | Stacked quote cards: business, rating, price (green SG700), Accept/Message actions. |
| Booking Details | `client/BookingDetailsScreen.js` | Status, provider row, service/where/total rows, escrow line ("$X · held in escrow" green), actions. |
| Review | `client/ReviewScreen.js` | Star rating input, comment field, submit CTA. |

## Client — discovery
| Screen label | Source file | Must contain |
|---|---|---|
| Search | `client/SearchScreen.js` | Search field, recent/suggested chips, result rows. |
| Nearby Map | `client/NearbyMapScreen.js` | Full-bleed map (mapBg gradient + grid), purple pins w/ pulse, bottom result sheet. |
| Favorites | `client/FavoritesScreen.js` | Saved-business cards; empty state (Feather heart in tinted circle) when none. |
| Business Profile (public) | `business/BusinessProfileScreen.js` | Header/hero, rating & verified pill, services, reviews, "Message"/"Book" CTAs. |
| Employee Profile | `business/EmployeeProfileScreen.js` | Employee avatar, role, assigned jobs/stats. |
| Message Thread | `messages/MessageThreadScreen.js` | Chat bubbles (mine = purple, theirs = surfaceAlt), input bar, sticky header w/ provider. |

## Client — account & flows
| Screen label | Source file | Must contain |
|---|---|---|
| Notifications | `profile/NotificationsCenterScreen.js` | Grouped notification rows, unread purple dot, relative timestamps. |
| Profile Edit | `profile/ProfileEditScreen.js` | Editable fields, avatar change, save CTA. |
| Payment Methods | `profile/PaymentMethodScreen.js` | Saved-card rows, default badge, "Add card" CTA. |
| Referral | `profile/ReferralScreen.js` | Reward hero, referral code w/ copy, share CTA, terms caption. |
| Cancellation Flow | `flows/CancellationFlowScreen.js` | Reason list (radio), policy/refund note, destructive confirm. |
| Dispute Flow (step 1) | `flows/DisputeFlowScreen.js` | Issue-type selection, evidence upload, next CTA. |
| Invoice | `shared/InvoiceScreen.js` | Line items, totals (green), tabular-nums, download/share. |
| Settings | `shared/SettingsScreen.js` | Grouped setting rows, toggles, section labels. (Help & FAQ and Terms removed per request.) |
| Privacy Policy | `profile/PrivacyPolicyScreen.js` | Long-form scroll body, section headers. |

## Auth & onboarding
| Screen label | Source file | Must contain |
|---|---|---|
| Onboarding | `onboarding/OnboardingScreen.js` | Value-prop slides, pager dots, purple CTA, "Log in" link. |
| Login | `auth/LoginScreen.js` | Email/password fields (focus → purple border), CTA, forgot/signup links. |
| Signup | `auth/SignupScreen.js` | Fields, role choice, CTA, terms caption. |
| Forgot Password | `auth/ForgotPasswordScreen.js` | Email field, send-reset CTA, back-to-login link. |

## Business side
| Screen label | Source file | Must contain |
|---|---|---|
| My Business (owner view) | `business/BusinessProfileScreen.js` **(owner mode)** | Same file as public profile in owner mode — edit affordances, services manager. ⚠ Confirm whether owner view is a prop/mode of `BusinessProfileScreen` or a separate screen; keep the codebase's actual split. |
| Job Management | `business/JobManagementScreen.js` | Tabbed job lists (active/upcoming/done), job rows w/ status pills. |
| Earnings | `business/EarningsScreen.js` | Earnings hero (green totals), payout history, period switcher. |
| Business Analytics | `business/BusinessAnalyticsScreen.js` | KPI cards, sparkline/chart (react-native-svg), period filter. |
| Business Invoices | `business/BusinessInvoicesScreen.js` | Invoice list rows, status pills, totals. |
| Employee Management | `business/EmployeeManagementScreen.js` | Team member rows, roles, add/invite CTA. |
| Business Setup | `onboarding/BusinessSetupScreen.js` | Multi-step business onboarding, progress, service categories. |

## Component sweep (touched by many screens — restyle once, reuse)
`Button`, `BottomNav` (client + business variants), `Chip`, `StatusPill`, `FeaturedCard`, `NearbyCard`, `JobOpportunityCard`, `CategoryScroll`, `BookingStatusTimeline`, avatar/initials tile, search field, list row, section header, skeleton block, empty-state block. Fix these in `components/` before the screens that use them.

## Done criteria (per screen)
A screen is complete only when: happy path matches its mock frame; **empty, loading, and error** states are restyled to the same system; no emoji / no pill buttons / no pure-white text / no off-scale padding (run the `POLISH-TIPS.md` §10 checklist); lint passes.
