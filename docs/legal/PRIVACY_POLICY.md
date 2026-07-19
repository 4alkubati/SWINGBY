# SwingBy — Privacy Policy

**Effective Date:** May 28, 2026
**Last Updated:** May 28, 2026
**Entity:** Swingbyy Inc.
**Contact:** 4alkubati@gmail.com

This Privacy Policy explains how Swingbyy Inc. ("SwingBy", "we", "us", "our") collects, uses, and protects personal information when you use the SwingBy mobile app or website (the "Service"). This Policy complies with Canada's *Personal Information Protection and Electronic Documents Act* (PIPEDA) and Alberta's *Personal Information Protection Act* (PIPA).

---

## 1. Information We Collect

### 1.1 Information you provide directly
- Name, email address, phone number, role (client / business / employee)
- Profile photo, business description, service category, service radius
- Job posts, quote amounts, booking schedules
- Messages exchanged with other users on job (quote) threads and bookings
- Reviews and ratings
- Payment-method metadata (we do not store card numbers — see §3.2)

### 1.2 Information collected automatically
- Approximate device location (when you grant permission) — used for nearby business discovery
- Device type, OS version, app version (for crash debugging via Sentry)
- IP address, request timestamps (for audit logging and rate-limiting)
- Expo push token (for sending booking notifications)

### 1.3 Information from third parties
- Authentication providers (when you sign in via OAuth — future feature)
- Aggregated analytics from Plausible (no personally identifying cookies)

---

## 2. How We Use Your Information

We use your information only for these purposes (PIPEDA §5: limited collection / limited use):

| Purpose | Examples |
|---|---|
| Provide the Service | Match clients with businesses; deliver messages; process bookings |
| Verify identity | Confirm signup email; phone for booking coordination |
| Improve the Service | Aggregate analytics (never tied to your identity); bug reports via Sentry |
| Communicate with you | Booking confirmations; receipts; security notifications |
| Comply with law | Tax remittance; subpoenas; PIPEDA breach reporting |

We do **not** sell or rent your personal information to third parties.

---

## 3. How We Share Your Information

### 3.1 Between users
- Clients see business profiles, ratings, and reviews
- Businesses browsing open jobs see the job description, uploaded photos, the client's name, and the job address — this is how they judge whether the job is in their service area before quoting
- Messages are visible only to the two parties on the job thread or booking they belong to
- Reviews are public on the reviewed party's profile (first name only, surname redacted)

### 3.2 With service providers (processors)
| Processor | Purpose | Location | Safeguards |
|---|---|---|---|
| Supabase Inc. | Database, authentication, file storage | Canada (ca-central-1) | SOC 2 Type II, GDPR-aligned DPA |
| Render Services Inc. | API hosting | United States | SOC 2 Type II, encryption at rest |
| Cloudflare Inc. | DNS, CDN, edge worker | Global | SOC 2, ISO 27001 |
| Sentry / Functional Software Inc. | Error monitoring | United States | SOC 2, DPA with EU SCCs |
| Expo / 650 Industries Inc. | Push notification delivery | United States | TLS in transit; tokens scoped to app |
| Notion Labs Inc. | Waitlist + early CRM | United States | SOC 2 Type II |

We share only the minimum data needed. Where transfers cross borders, we rely on contractual safeguards.

### 3.3 With law enforcement
We may disclose information when legally required (PIPEDA §7(3)). We will challenge over-broad requests and notify affected users where law permits.

---

## 4. Your Rights

Under PIPEDA and PIPA you may, at any time:

| Right | How to exercise |
|---|---|
| Access your data | In-app: Settings → Privacy → Export my data — produces a JSON file of everything we have about you |
| Correct your data | In-app: Settings → Edit profile |
| Withdraw consent / delete | In-app: Settings → Delete my account — irreversibly removes your profile within 30 days |
| Challenge our compliance | Email 4alkubati@gmail.com — we respond within 30 days per PIPEDA §29 |
| Complaint to regulator | Office of the Privacy Commissioner of Canada — priv.gc.ca |

---

## 5. Data Retention

| Category | Retention period |
|---|---|
| Active account data | While the account is active |
| Deleted account data | Anonymized within 30 days; messages and reviews retained as anonymous to preserve thread integrity |
| Audit logs | 24 months (security and dispute resolution) |
| Payment records | 7 years (Canada Revenue Agency tax requirement) |
| Sentry crash logs | 90 days |
| Push tokens | Until revoked or replaced |

---

## 6. Security

We protect your information with:

- TLS 1.2+ on every network request
- Tokens stored in iOS Keychain / Android Keystore (never plain disk)
- Database access scoped by row-level security (RLS) — users can only see their own rows
- Service role keys held only on our server, never embedded in the mobile app
- Rate-limiting and brute-force lockout on authentication endpoints
- Sentry error logs strip stack-trace local-variable values
- Annual third-party security review (planned post-launch)

No system is impenetrable. In the event of a breach affecting your information, we will notify you and the Office of the Privacy Commissioner per PIPEDA §10.1 within 72 hours of confirmation.

---

## 7. Children

SwingBy is not intended for users under 16. We do not knowingly collect information from children. If you believe we have collected information from a minor, email 4alkubati@gmail.com and we will delete it promptly.

---

## 8. Changes to this Policy

We may update this Policy. Material changes will be announced in-app and via email at least 30 days before they take effect. Continued use after the effective date is acceptance.

---

## 9. Contact

**Privacy Officer**
Swingbyy Inc.
4alkubati@gmail.com

For data-access requests under PIPEDA / PIPA, include "Data Request" in your subject line. We respond within 30 days.
