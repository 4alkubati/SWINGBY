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
      ReferralScreen: 'invite/:code',
    },
  },
};
