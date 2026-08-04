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
      BetaInvite: 'invite/:code',
    },
  },
};
