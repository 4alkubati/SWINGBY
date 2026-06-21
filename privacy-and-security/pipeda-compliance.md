# PIPEDA Compliance Checklist

> Canada's Personal Information Protection and Electronic Documents Act (PIPEDA) — 10 fair information principles.

**Last reviewed:** June 6, 2026  
**Next review:** June 2027 (or after any major feature addition)

---

## Overview

PIPEDA applies to SwingBy as a private-sector organization engaged in commercial activity, collecting personal information in the course of that activity. All provinces are covered by PIPEDA for commercial activities, except Alberta, British Columbia, and Quebec — which have substantially similar provincial laws. Since SwingBy is based in Alberta, Alberta's PIPA (Personal Information Protection Act) applies. PIPA and PIPEDA are nearly identical in the 10 principles below.

---

## Principle 1 — Accountability

### What PIPEDA requires
An organization is responsible for personal information under its control. A named individual must be designated as responsible for the organization's compliance.

### What SwingBy does
- **Privacy Officer:** Amr Alkubati (founder) is the designated Privacy Officer.
- Privacy contact: privacy@swingbyy.com
- This privacy-and-security folder documents our compliance posture.
- Third-party subprocessors are listed in [subprocessors.md](subprocessors.md) with contractual data protection obligations.

### Gap / TODO
- [ ] Formalize a written Privacy Management Program document as the organization grows
- [ ] When the first non-founder employee joins, assign a deputy privacy contact and document the chain of accountability

---

## Principle 2 — Identifying Purposes

### What PIPEDA requires
The purposes for which personal information is collected must be identified by the organization before or at the time of collection.

### What SwingBy does
- All collection purposes are listed in [privacy-policy.md](privacy-policy.md) → Section 5 (legal bases table)
- The purpose for each data field is mapped to a specific use case (account creation, booking, payment, analytics, etc.)
- Users are informed of collection purposes at signup via the privacy policy link and summary

### Gap / TODO
- [ ] Add a one-sentence purpose notice at each in-app data collection point (e.g., "We use your phone number to send booking notifications")
- [ ] Ensure any new data collection is preceded by an update to the privacy policy before rollout

---

## Principle 3 — Consent

### What PIPEDA requires
The knowledge and consent of the individual is required for the collection, use, or disclosure of personal information. Consent can be express (explicit) or implied (from the relationship).

### What SwingBy does
- Users consent to data collection on account creation (checkbox + link to privacy policy)
- Marketing emails require opt-in consent (separate from account creation)
- Cookie consent banner controls analytics and marketing cookies
- Implied consent covers data necessary to perform the service (e.g., storing booking details)

### Gap / TODO
- [ ] Implement a granular consent UI for analytics and marketing cookies in the web app
- [ ] Add a "manage preferences" screen in the mobile app (Settings → Privacy)
- [ ] Confirm email opt-in is not pre-checked at signup (it must default to unchecked)

---

## Principle 4 — Limiting Collection

### What PIPEDA requires
The collection of personal information shall be limited to that which is necessary for the purposes identified.

### What SwingBy does
- We do not collect date of birth, SIN, government ID (except for Verified Business applications)
- Location data is collected only when the user enables location permissions
- We do not collect financial account information — all payment data goes through Stripe directly
- The data fields in each database table are reviewed against business necessity

### Gap / TODO
- [ ] Conduct a data minimization audit before each major product launch (add a step to the launch checklist)
- [ ] Remove any deprecated fields from the database that are no longer used

---

## Principle 5 — Limiting Use, Disclosure, and Retention

### What PIPEDA requires
Personal information shall not be used or disclosed for purposes other than those for which it was collected, except with consent or as required by law. Retention is limited to what is necessary.

### What SwingBy does
- Data is used only for the purposes stated in [privacy-policy.md](privacy-policy.md)
- We do not sell personal data to third parties
- Retention schedules are defined in [data-handling.md](data-handling.md) → Section 9
- Subprocessors are prohibited from using SwingBy user data for their own purposes

### Gap / TODO
- [ ] Implement automated data deletion for expired retention periods (booking data after 7 years, etc.) — currently manual
- [ ] Add formal subprocessor data processing agreements (DPAs) before going live

---

## Principle 6 — Accuracy

### What PIPEDA requires
Personal information shall be as accurate, complete, and up-to-date as necessary for the purposes for which it is to be used.

### What SwingBy does
- Users can update their own account data at any time through Settings → Profile
- Business owners can update business information including address, category, and service radius
- Reviews cannot be edited after submission (accuracy is preserved for trust)
- Users can submit corrections via privacy@swingbyy.com (DSAR correction process in [data-handling.md](data-handling.md))

### Gap / TODO
- [ ] Add an in-app notification if a user's email address bounces, prompting them to update it
- [ ] Add profile completeness nudges to encourage up-to-date information

---

## Principle 7 — Safeguards

### What PIPEDA requires
Personal information shall be protected by security safeguards appropriate to the sensitivity of the information.

### What SwingBy does
- Full security posture documented in [security-overview.md](security-overview.md)
- Key measures: TLS in transit, AES-256 at rest, Row Level Security on all tables, JWT expiry, MFA on all admin accounts, service role key isolated to backend
- Payment data never stored (Stripe is PCI-DSS Level 1)
- Error monitoring (Sentry) does not log PII
- Security checklist runs quarterly: [security-checklist.md](security-checklist.md)

### Gap / TODO
- [ ] Add formal penetration test before the first major marketing push (ideally a third-party pen test)
- [ ] Add dependency vulnerability scanning to CI/CD pipeline (Dependabot or equivalent)
- [ ] Implement Web Application Firewall (WAF) before the platform reaches significant scale

---

## Principle 8 — Openness

### What PIPEDA requires
An organization shall make readily available to individuals specific information about its policies and practices relating to the management of personal information.

### What SwingBy does
- Privacy policy is publicly accessible at swingbyy.com/privacy
- Cookie policy is publicly accessible at swingbyy.com/cookies
- Terms of service are publicly accessible at swingbyy.com/terms
- Security overview is publicly accessible at swingbyy.com/security
- Subprocessors list is publicly accessible

### Gap / TODO
- [ ] Publish all policy pages on the live website before any user data is collected
- [ ] Add footer links to all legal pages on swingbyy.com
- [ ] Publish a "last updated" changelog on the privacy policy page so users can track changes

---

## Principle 9 — Individual Access

### What PIPEDA requires
Upon request, an individual shall be informed of the existence, use, and disclosure of their personal information and shall be given access to that information.

### What SwingBy does
- DSAR process documented in [data-handling.md](data-handling.md) → Section 6
- 30-day response target
- Identity verification required before release
- Users can access and export their data on request
- Users can view and edit most of their own data in-app

### Gap / TODO
- [ ] Build a self-service data export feature in the app (Settings → Export My Data) to reduce manual DSAR burden
- [ ] Build a self-service account deletion flow that triggers the automated deletion process

---

## Principle 10 — Challenging Compliance

### What PIPEDA requires
An individual shall be able to address a challenge concerning compliance with the above principles to the designated individual accountable for the organization's compliance.

### What SwingBy does
- Privacy contact is publicly listed: privacy@swingbyy.com
- Privacy policy includes information on how to complain to the Office of the Privacy Commissioner of Canada
- Internal DSAR log tracks all requests and resolutions

### Gap / TODO
- [ ] Add a formal complaint acknowledgment template (send within 5 business days of receiving a complaint)
- [ ] Add a section to the privacy policy explaining the formal complaint process step by step

---

## Summary — Status by principle

| Principle | Status |
|---|---|
| 1. Accountability | Partially implemented — formalization needed |
| 2. Identifying Purposes | Implemented |
| 3. Consent | Partially implemented — granular consent UI needed |
| 4. Limiting Collection | Implemented |
| 5. Limiting Use / Retention | Partially implemented — automated deletion needed |
| 6. Accuracy | Implemented |
| 7. Safeguards | Implemented at MVP level — pen test needed before scale |
| 8. Openness | Needs website publication |
| 9. Individual Access | Process documented — self-service tooling needed |
| 10. Challenging Compliance | Partially implemented |

---

## Cross-links

- [privacy-policy.md](privacy-policy.md) — user-facing policy
- [data-handling.md](data-handling.md) — internal SOP
- [security-overview.md](security-overview.md) — security posture (Principle 7)
- [incident-response.md](incident-response.md) — breach response (Principle 7)
