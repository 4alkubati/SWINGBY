# Swingby Cross-Platform Parity Audit

**Date:** 2026-06-01

## Feature Coverage Matrix

| Feature / Screen | Mobile (React Native) | Web Pre-Launch | Web Admin |
|---|---|---|---|
| **Authentication** | | | |
| Login | LoginScreen.js | Login.jsx | LoginPage.jsx |
| Signup / Onboarding | SignupScreen.js, OnboardingScreen.js | Signup.jsx | — |
| **Dashboard** | DashboardScreen.js | Dashboard.jsx | DashboardPage.jsx |
| **User Profile** | ProfileScreen.js, ProfileEditScreen.js | — | UsersPage.jsx |
| **Bookings** | ActiveBookingScreen.js, BookingDetailsScreen.js, MyJobsScreen.js | — | BookingsPage.jsx |
| **Businesses** | BusinessProfileScreen.js, BusinessAnalyticsScreen.js | — | BusinessesPage.jsx |
| **Job Management** | JobManagementScreen.js, PostJobScreen.js | — | — |
| **Search / Discovery** | SearchScreen.js, NearbyMapScreen.js, MapScreen.js | — | — |
| **Messaging / Chat** | ChatScreen.js, MessagesScreen.js, MessageThreadScreen.js | — | — |
| **Payments / Earnings** | PaymentMethodScreen.js, EarningsScreen.js | — | — |
| **Reviews** | ReviewScreen.js | — | — |
| **Quotes** | QuoteComparisonScreen.js | — | — |
| **Employees** | EmployeeManagementScreen.js, EmployeeProfileScreen.js | — | — |
| **Referrals** | ReferralScreen.js | — | — |
| **Favorites** | FavoritesScreen.js | — | — |
| **Notifications** | NotificationsScreen.js, NotificationsCenterScreen.js | — | — |
| **Cancellation / Disputes** | CancellationFlowScreen.js, DisputeFlowScreen.js | — | — |
| **Settings** | SettingsScreen.js | — | — |
| **Help / FAQ** | HelpFAQScreen.js | ComingSoon.jsx (FAQ section) | — |
| **Legal** | PrivacyPolicyScreen.js, TermsOfServiceScreen.js | PrivacyPage.jsx, TermsPage.jsx | — |
| **Audit Log** | — | — | AuditLogPage.jsx |
| **Command Palette** | — | — | (global component) |
| **404 / Not Found** | — | NotFoundPage.jsx | — |
| **Coming Soon** | — | ComingSoon.jsx | — |

## Parity Gaps

### Mobile-only (no web equivalent)
- Map / location discovery (MapScreen, NearbyMapScreen, SearchScreen)
- Real-time chat and messaging (ChatScreen, MessagesScreen, MessageThreadScreen)
- Cancellation flow and dispute flow
- Quote comparison
- Referral program
- Favorites
- Earnings screen
- Employee management
- Job posting flow (PostJobScreen, JobManagementScreen)
- Notifications center

### Web Pre-Launch only (no mobile equivalent)
- Coming Soon / waitlist page
- 404 Not Found page

### Admin only (no mobile/pre-launch equivalent)
- Audit log
- Businesses management
- Admin-level user management (read/write on all users)
- Command palette
- Force-complete booking action
- Verify business action

### Shared across all three platforms
- Authentication (Login)
- Dashboard

### Shared between Mobile and Web Pre-Launch only
- Signup / Onboarding
- Legal pages (Privacy, Terms)
- Help / FAQ content

### Shared between Mobile and Web Admin only
- Bookings (different scopes: user-facing vs. admin)
- User profile data (self-manage vs. admin-manage)
- Business profile (owner-facing vs. admin-facing)
