# Subprocessors

> Third-party services that process personal data on SwingBy's behalf.

**Last updated:** June 6, 2026

SwingBy uses the following subprocessors to provide its platform. Each has been selected for reliability, security posture, and data protection standards. This list is updated when we add, change, or remove a vendor.

---

## Current subprocessors

### Supabase

| Field | Detail |
|---|---|
| **Purpose** | Database hosting, user authentication, file storage |
| **Data processed** | All user data: accounts, businesses, bookings, payments, messages, reviews |
| **Hosting location** | Canada — AWS ca-central-1 (Montreal, Quebec) |
| **Privacy policy** | supabase.com/privacy |
| **DPA** | Supabase provides a DPA at supabase.com/legal/dpa |
| **Security certifications** | SOC 2 Type II |
| **Notes** | Primary data processor. All personal data at rest is stored here. |

---

### Stripe

| Field | Detail |
|---|---|
| **Purpose** | Payment processing and escrow |
| **Data processed** | Payment amounts, transaction IDs, payout records. Stripe directly processes card data — SwingBy does not. |
| **Hosting location** | United States (with EU infrastructure available) |
| **Privacy policy** | stripe.com/privacy |
| **DPA** | stripe.com/legal/dpa |
| **Security certifications** | PCI-DSS Level 1, SOC 2, ISO 27001 |
| **Notes** | SwingBy never receives or stores card numbers, CVVs, or expiry dates. |

> TODO (HUMAN): Confirm Stripe integration is live and the Connect account is configured before publishing.

---

### Google Maps Platform

| Field | Detail |
|---|---|
| **Purpose** | Map display, geocoding (converting addresses to lat/lng coordinates), location-based search |
| **Data processed** | Location coordinates submitted during geo-browse or business profile creation |
| **Hosting location** | United States (Google global infrastructure) |
| **Privacy policy** | policies.google.com/privacy |
| **DPA** | cloud.google.com/terms/data-processing-addendum |
| **Security certifications** | ISO 27001, SOC 2, SOC 3 |
| **Notes** | Lat/lng data is sent to Google Maps API on map load and search. No PII (names, emails) is sent. |

---

### Sentry

| Field | Detail |
|---|---|
| **Purpose** | Error monitoring and crash reporting |
| **Data processed** | Stack traces, error messages, request metadata (URL, status code, user ID). Configured to scrub PII. |
| **Hosting location** | United States (sentry.io cloud). EU hosting available on Business plan. |
| **Privacy policy** | sentry.io/privacy |
| **DPA** | sentry.io/legal/dpa |
| **Security certifications** | SOC 2 Type II |
| **Notes** | Sentry is configured with PII scrubbing rules. Message content, payment data, and passwords are not included in error payloads. |

---

### Expo (EAS — Expo Application Services)

| Field | Detail |
|---|---|
| **Purpose** | Mobile app builds, over-the-air updates, and push notification delivery |
| **Data processed** | Expo Push Tokens (device identifiers), notification content |
| **Hosting location** | United States |
| **Privacy policy** | expo.dev/privacy |
| **DPA** | expo.dev/dpa |
| **Security certifications** | SOC 2 (in progress as of 2026) |
| **Notes** | Push tokens are used only to deliver notifications to the correct device. We do not share tokens with third parties. |

---

### Resend / Amazon SES / Postmark (transactional email)

| Field | Detail |
|---|---|
| **Purpose** | Sending transactional emails: welcome, booking confirmation, password reset, notifications |
| **Data processed** | Email address, first name, email content |
| **Hosting location** | United States |
| **Privacy policy** | resend.com/privacy / docs.aws.amazon.com/ses (SES) / postmarkapp.com/privacy-policy |
| **DPA** | Available from each provider on request |
| **Security certifications** | SOC 2 (Resend, Postmark) |
| **Notes** | Email content is transactional only — not used for marketing without separate consent. |

> TODO (HUMAN): Confirm which transactional email provider is in use before publishing.

---

### PostHog / Plausible (analytics)

| Field | Detail |
|---|---|
| **Purpose** | Product analytics: page views, feature usage, funnel analysis |
| **Data processed** | Anonymized usage events, device type, session data. No PII by default. |
| **Hosting location** | PostHog cloud: US or EU. Plausible: EU (Germany). Self-hosted option available. |
| **Privacy policy** | posthog.com/privacy / plausible.io/privacy |
| **DPA** | posthog.com/dpa / plausible.io/dpa |
| **Security certifications** | SOC 2 (PostHog) |
| **Notes** | Plausible uses no cookies and no fingerprinting. PostHog can be configured for cookie-free tracking. |

> TODO (HUMAN): Confirm which analytics provider is active and whether self-hosted or cloud.

---

### Cloudflare (CDN and DDoS protection)

| Field | Detail |
|---|---|
| **Purpose** | Content delivery, DDoS mitigation, DNS |
| **Data processed** | IP addresses (in transit), HTTP headers, cached static assets |
| **Hosting location** | Global edge network (US-based corporate entity) |
| **Privacy policy** | cloudflare.com/privacypolicy |
| **DPA** | cloudflare.com/gdpr/introduction |
| **Security certifications** | ISO 27001, SOC 2, PCI DSS |
| **Notes** | Cloudflare does not have access to database contents. IP logs are transient. |

> TODO (HUMAN): Confirm whether Cloudflare is in use. If only DNS, data processing is minimal.

---

## Notifications about changes

We will update this page when we add, change, or remove a subprocessor. Enterprise customers and users who have signed a DPA will be notified of material changes with at least 30 days advance notice per the [DPA template](dpa-template.md).

---

## Questions

If you have questions about our subprocessors or data processing practices, contact:  
**Email:** privacy@swingby.ca
