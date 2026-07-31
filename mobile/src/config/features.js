// features.js — build-time feature flags.
//
// BUILD-TIME, NOT SERVER-DRIVEN, and that is the whole point.
//
// The obvious precedent in this codebase is GoogleReviewsConnect, whose hint is
// driven by a server flag (GOOGLE_REVIEWS_ENABLED -> /google-reviews/status).
// That shape is wrong here. App Store Guideline 3.1.1 forbids an iOS app from
// linking out to a purchase flow for digital goods, and a purchase button that
// a server can switch on after review is precisely the thing the rule exists to
// catch. A remote flag would also mean a network failure decides whether the
// app is compliant — which is not a decision a timeout should get to make.
//
// So: a constant, compiled into the binary, changed only by shipping a build.

/**
 * Can a business owner START a paid subscription from inside the app?
 *
 * FALSE for iOS v1. Business subscriptions are a platform membership fee, which
 * is genuinely grey under 3.1.1: bookings themselves are real-world services
 * performed in person and sit outside IAP under 3.1.3(e), but a recurring fee
 * for extra app features does not obviously get the same treatment. The safe
 * pattern — and the one this flag produces — is web-only signup with read-only
 * status in the app.
 *
 * Flipping this to `true` is NOT a one-line change. It requires either an
 * App Store IAP product with StoreKit wired up, or a written determination that
 * the fee falls outside 3.1.1. See Roadmap/dominoes/D2.4-business-subscription.md.
 */
export const SUBSCRIPTION_PURCHASE = false;

/**
 * Can the app SHOW an existing subscription's status?
 *
 * TRUE. Reading state is not selling anything — 3.1.1 restricts purchase flows,
 * not information. An owner who subscribed on the web must be able to see that
 * they did, otherwise the app looks broken to the person actually paying for it.
 * Prices are still stripped from the labels: a dollar figure next to a hidden
 * purchase path is the mixed signal that turns a reviewer's glance into a
 * question.
 */
export const SUBSCRIPTION_STATUS_DISPLAY = true;
