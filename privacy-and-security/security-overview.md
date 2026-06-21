# Security Overview

> How SwingBy protects your data. Written for users and partners — not for security engineers.

**Last updated:** June 6, 2026

---

## Our approach

Security is built into the platform from the start — not added after. We make specific, verifiable decisions about how data is stored, accessed, and protected. This document summarizes those decisions.

If you are a security researcher and have found an issue, see our [Vulnerability Disclosure Policy](vulnerability-disclosure.md).

---

## Authentication

**How you log in:**

SwingBy uses Supabase Auth, which implements industry-standard authentication flows. Your password is never stored in plaintext — it is hashed using bcrypt before storage. SwingBy staff cannot read your password.

**JWT tokens:**

When you log in, you receive a JSON Web Token (JWT) that proves your identity to the platform. Tokens expire after 3,600 seconds (1 hour). When a token expires, you re-authenticate automatically using a refresh token stored securely on your device.

JWTs are signed with a secret key known only to the backend. A modified or forged JWT is rejected.

**Brute force protection:**

Supabase Auth includes rate limiting on login attempts. Accounts are temporarily locked after repeated failed attempts.

---

## Authorization

**Row Level Security (RLS):**

Every table in the SwingBy database has Row Level Security enabled. RLS is a database-level control — it is enforced by the database itself, not just by the application code. This means:

- You can only read your own user profile
- You can only read bookings you are a party to (as client, business owner, or assigned employee)
- You can only read messages on bookings you are involved in
- You can only read payment details for your own bookings
- Businesses can only be written to by their owner

There are **no tables open to anonymous access**. Every data operation requires authentication.

**Service role isolation:**

Our backend API uses a privileged "service role" key to perform operations on behalf of authenticated users. This key:
- Is stored only in the backend server environment
- Is never present in the mobile app or web frontend code
- Is never committed to our code repository

The mobile app and web frontend cannot directly access the database. All data flows through our API.

The full RLS policy is in `docs/rls_policies.sql` (available to auditors upon request).

---

## Data encryption

**In transit:**

All data transmitted between your device and SwingBy servers is encrypted using TLS 1.2 or higher. This applies to the API, the authentication service, and the web dashboard. There is no HTTP (unencrypted) access to any endpoint that handles personal data.

**At rest:**

The SwingBy database is hosted on Supabase, which runs on AWS in the ca-central-1 region (Montreal, Canada). AWS encrypts all stored data at rest using AES-256.

Backups are encrypted using the same standard.

---

## Payment security

**We never touch your card data.**

Payment processing is handled by Stripe, which is a PCI-DSS Level 1 certified service provider — the highest level of PCI compliance. Your card number, CVV, and expiry date are entered directly into Stripe's secure form and never transmitted to or stored on SwingBy's servers.

SwingBy stores only:
- Stripe payment intent IDs (a reference number, not card data)
- Booking amounts
- Escrow and payout status

If SwingBy's servers were compromised, no card data would be at risk because we do not have it.

---

## Infrastructure

| Component | Provider | Region |
|---|---|---|
| Database, auth, storage | Supabase (on AWS) | ca-central-1 (Montreal) |
| Backend API | Render | Oregon (us-west) |
| Mobile app delivery | Expo EAS | US |
| CDN / DDoS protection | Cloudflare | Global edge |

SwingBy's backend does not run on a shared web host. It runs as a containerized service with environment-variable-based configuration. There is no configuration file with credentials on disk.

---

## Secrets management

Secrets (database passwords, API keys, Supabase service keys) are managed as follows:

- Never committed to the code repository (enforced by `.gitignore` and periodic audits)
- Stored as environment variables in the hosting provider's secret management system
- The Supabase service role key is accessible only to the backend API — not the mobile app or web frontend
- If a key is compromised, it can be rotated from the provider dashboard without a deployment

---

## Monitoring and incident detection

**Error monitoring:** Sentry is integrated into the backend and web frontend. Errors are captured with stack traces and request context. Sentry does not capture passwords, card data, or full message content.

**Structured logging:** The backend logs all authentication events, including successful logins, failed attempts, and token errors. Logs are retained for 90 days.

**Uptime monitoring:** We use an uptime monitoring service to alert on API downtime. Response time and availability are tracked continuously.

---

## Backup and recovery

**Automatic backups:** Supabase performs automated daily backups of the database. On our current free plan, backups are retained for 7 days. We will evaluate upgrading to the Pro plan (point-in-time recovery, 30-day retention) once the platform processes recurring paying-customer transactions.

**Recovery targets:**
- Recovery Point Objective (RPO): 24 hours (maximum data loss in a catastrophic failure)
- Recovery Time Objective (RTO): 4 hours (maximum time to restore service)

---

## Vulnerability disclosure

If you have found a security vulnerability in SwingBy, please report it responsibly. See our [Vulnerability Disclosure Policy](vulnerability-disclosure.md) for how to report, what we commit to, and safe harbor terms.

We take all good-faith security reports seriously. We will acknowledge receipt within 72 hours and provide a status update within 7 days.

---

## Compliance posture

| Standard | Status |
|---|---|
| PIPEDA (Canadian privacy law) | In progress — see [pipeda-compliance.md](pipeda-compliance.md) |
| SOC 2 Type II | Planned (year 2) |
| PCI-DSS | Compliant via Stripe (we do not process card data directly) |
| GDPR | Addressable — privacy policy includes EU user rights |

---

## Questions

If you have questions about SwingBy's security practices, contact us at:  
**Email:** security@swingbyy.com
