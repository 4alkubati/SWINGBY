// Web stub for @stripe/stripe-react-native — WEB BUNDLE ONLY.
//
// nativePay.js already guards this package with a lazy require() inside a
// try/catch, because it is absent in Expo Go. That guard is a RUNTIME check;
// Metro still resolves the module statically when bundling, so the web build
// fails on it regardless. Hence a resolver-level stub.
//
// Every export throws or reports "unavailable" rather than pretending to work.
// A payment surface that silently no-ops on web would be worse than a missing
// one: someone click-testing would believe they had exercised the money path.
const UNAVAILABLE = 'native_sheet_unavailable: the Stripe Payment Sheet is a native module and does not run on web. Test payments on a device.';

export const initStripe = async () => { throw new Error(UNAVAILABLE); };
export const initPaymentSheet = async () => ({ error: { message: UNAVAILABLE } });
export const presentPaymentSheet = async () => ({ error: { message: UNAVAILABLE } });
export const confirmPayment = async () => ({ error: { message: UNAVAILABLE } });
export const useStripe = () => ({
  initPaymentSheet,
  presentPaymentSheet,
  confirmPayment,
});
export const StripeProvider = ({ children }) => children;

export default { initStripe, useStripe, StripeProvider };
