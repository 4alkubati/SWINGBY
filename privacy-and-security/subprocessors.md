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

### Stripe (planned — not yet integrated)

| Field | Detail |
|---|---|
| **Purpose** | Payment processing and escrow |
| **Status** | **Not yet integrated.** SwingBy is currently in pre-launch testing. Stripe will be enabled before public launch, after the business email is provisioned and Stripe Connect onboarding is complete. |
| **Data processed (once live)** | Payment amounts, transaction IDs, payout records. Stripe directly processes card data — SwingBy does not. |
| **Hosting location** | United States (with EU infrastructure available) |
| **Privacy policy** | stripe.com/privacy |
| **DPA** | stripe.com/legal/dpa |
| **Security certifications** | PCI-DSS Level 1, SOC 2, ISO 27001 |
| **Notes** | When live, SwingBy will never receive or store card numbers, CVVs, or expiry dates. |

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

### Resend (transactional email)

| Field | Detail |
|---|---|
| **Purpose** | Sending transactional emails: welcome, booking confirmation, password reset, notifications |
| **Data processed** | Email address, first name, email content |
| **Hosting location** | United States |
| **Privacy policy** | resend.com/privacy |
| **DPA** | resend.com/legal/dpa |
| **Security certifications** | SOC 2 Type II |
| **Notes** | Email content is transactional only — not used for marketing without separate consent. Marketing emails (if launched later) will use a separate sender domain and CASL-compliant double opt-in. |

---

### Cloudflare Web Analytics (web analytics)

| Field | Detail |
|---|---|
| **Purpose** | Aggregate web analytics — page views, referrers, country-level visitor data |
| **Data processed** | Page URL, referrer, anonymized visit data. **No cookies.** **No cross-site tracking.** **No persistent identifiers.** |
| **Hosting location** | Global edge (Cloudflare). Aggregated server-side. |
| **Privacy policy** | cloudflare.com/web-analytics (privacy notice) |
| **DPA** | cloudflare.com/gdpr/introduction |
| **Security certifications** | ISO 27001, SOC 2, PCI DSS |
| **Notes** | Cookie-free and privacy-first by design — no consent banner required under PIPEDA/GDPR. We do not use any product analytics tool (PostHog, Mixpanel, etc.) at this stage. |

---

### Cloudflare (CDN, DDoS protection, DNS, web analytics)

| Field | Detail |
|---|---|
| **Purpose** | Content delivery, DDoS mitigation, DNS, bot protection, rate limiting, web analytics |
| **Data processed** | IP addresses (in transit), HTTP headers, cached static assets, aggregated analytics |
| **Hosting location** | Global edge network (US-based corporate entity) |
| **Privacy policy** | cloudflare.com/privacypolicy |
| **DPA** | cloudflare.com/gdpr/introduction |
| **Security certifications** | ISO 27001, SOC 2, PCI DSS |
| **Notes** | Cloudflare does not have access to database contents. IP logs are transient. Used as our primary edge layer — the entire `swingbyy.com` zone is proxied through Cloudflare. |

---

## Notifications about changes

We will update this page when we add, change, or remove a subprocessor. Enterprise customers and users who have signed a DPA will be notified of material changes with at least 30 days advance notice per the [DPA template](dpa-template.md).

---

## Questions

If you have questions about our subprocessors or data processing practices, contact:  
**Email:** privacy@swingbyy.com
