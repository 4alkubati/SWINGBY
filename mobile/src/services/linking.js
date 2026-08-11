export const linkingConfig = {
  prefixes: ['swingby://', 'https://swingbyy.com'],
  config: {
    screens: {
      BookingDetails: 'booking/:bookingId',
      QuoteComparison: 'quotes/:postId',
      BusinessProfile: 'business/:businessId',
      EmployeeProfile: 'business/:businessId/employee/:employeeId',
      MessageThread: 'messages/:bookingId',
      Onboarding: 'welcome',
      // `invite/:code` used to open ReferralScreen — the LOGGED-IN user's own
      // "share SwingBy" page. A recruited tester tapping their invite link is not
      // logged in and does not have a code to share; they were being shown the
      // wrong side of the feature. It now opens the invite card.
      //
      // F091: the real link sent to testers is the QUERY form
      // (`swingby://invite?code=<CODE>` — see BetaInviteCardScreen.js and
      // i18n.js), not a path segment. `invite/:code` only matches
      // `swingby://invite/<CODE>` and silently fails to match the query form —
      // React Navigation just doesn't open anything, a dead tap for every
      // recruited tester. Registering the bare path lets
      // `parseQueryParams` (getStateFromPath) merge `?code=` into
      // route.params the same way it would for a path segment.
      BetaInvite: 'invite',
    },
  },
};
