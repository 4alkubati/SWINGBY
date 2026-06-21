# Data Handling — Internal SOP

> For the SwingBy team. Not public. Governs how we handle personal data internally.

**Last updated:** June 6, 2026  
**Review cadence:** Quarterly

---

## 1. Data classification

All data SwingBy handles is classified into one of four categories.

| Classification | Definition | Examples |
|---|---|---|
| **Public** | Intentionally visible to any user or the internet | Business name, business category, average rating, review content (for businesses) |
| **Internal** | Visible to authenticated users within the platform — not the internet | Service post details, booking status, employee records |
| **Confidential** | Visible only to parties directly involved | Messages, payment amounts, client contact info |
| **Restricted** | Access limited to SwingBy team with explicit need-to-know | Supabase service role key, Stripe secret keys, user passwords (hashed), raw database access |

---

## 2. Per-table data classification

| Table | Classification | Who can access |
|---|---|---|
| `users` | Confidential (own row) / Restricted (other rows) | User sees only their own row; service role for backend operations |
| `businesses` | Public (name, category, rating) / Internal (other fields) | All authenticated users can browse; owner edits own |
| `employees` | Internal | Business owner and the employee themselves |
| `service_posts` | Internal | Client who posted; all authenticated businesses (open posts) |
| `interests` | Confidential | Business that expressed; client whose post it is |
| `bookings` | Confidential | Client, business owner, assigned employee |
| `payments` | Confidential | Client and business of that booking |
| `messages` | Confidential | Booking participants only |
| `reviews` | Public (business reviews) / Confidential (client reviews) | Business reviews visible to all; client reviews only to parties |
| `cancellations` | Confidential | Client and business of that booking |

---

## 3. Access controls

### 3.1 Database access

| Role | Access | Who has it |
|---|---|---|
| Supabase anon key | No access (RLS blocks all anon) | Mobile/web app (does not use) |
| Supabase auth user JWT | Read/write own data per RLS policies | App users |
| Supabase service role key | Full access, bypasses RLS | Backend API only |
| Supabase dashboard (direct) | Full read/write | Founder only |

The service role key must never be given to:
- Frontend developers who do not have a need to run backend queries
- Third parties
- Anyone outside the core engineering team

### 3.2 Hosting / infrastructure access

| System | Who has access | How access is granted |
|---|---|---|
| Supabase dashboard | Founder | Email + password + MFA |
| Hosting provider (Render / Fly / etc.) | Founder + backend engineers | Invite via email, MFA required |
| AWS (via Supabase) | Supabase manages; not direct | N/A |
| GitHub repository | Founder + contributors | GitHub invite |
| Stripe dashboard | Founder | Email + password + MFA |

**MFA is mandatory** for all production system access. No exceptions.

### 3.3 Analytics and monitoring

| Tool | Who can access | Data sensitivity |
|---|---|---|
| PostHog | Founder | Aggregate, no PII |
| Sentry | Founder + engineers | Error context — no passwords, no payment data |
| Supabase logs | Founder | Query logs |

---

## 4. Onboarding checklist — team members with data access

When a new team member joins and needs access to production data or systems:

- [ ] Confirm their role and what access they actually need (minimum necessary)
- [ ] Create a Supabase invite (read-only unless engineer role is confirmed)
- [ ] Create a hosting platform invite (backend engineers only)
- [ ] Grant GitHub repository access at appropriate permission level
- [ ] Brief them on this document and the privacy policy
- [ ] Confirm they have MFA enabled before granting access
- [ ] Log the access grant in this document under "Access log" (add a new section)
- [ ] Set a review reminder for 90 days to confirm access is still needed

**The service role key is never shared with new team members** unless they are running backend infrastructure. It is set as an environment variable in the hosting provider — it is not emailed or messaged.

---

## 5. Offboarding checklist — removing data access

When a team member leaves or changes roles:

- [ ] Revoke Supabase dashboard access immediately
- [ ] Revoke hosting provider access immediately
- [ ] Remove from GitHub organization or repository
- [ ] If they had access to service role key: rotate the key in Supabase → Settings → API, and update the environment variable in all deployment environments
- [ ] Remove from any shared Slack channels with sensitive information
- [ ] Document the offboarding in an internal access log

**Rotation of the service role key is mandatory** if a departing team member had access to it. Do not assume they won't use it after leaving.

---

## 6. Data Subject Access Request (DSAR) SOP

PIPEDA gives individuals the right to access and correct their personal data. The target response time is 30 days.

### Step 1 — Receive and log the request

DSAR requests come to privacy@swingbyy.com. Log the request immediately:
- Name of requestor
- Email used to submit
- Date received
- Type of request (access, correction, deletion, export, or other)

### Step 2 — Verify identity (5 days)

Before releasing any data, verify the requestor is who they say they are.
- Ask them to reply from the email address associated with their SwingBy account
- If they have no account, ask for a government ID (redacted except for name and face)
- Do not release data if identity cannot be confirmed

### Step 3 — Locate the data (5 days)

Query the following to gather all data associated with the user's account:
- `users` table — profile data
- `businesses` table — any business they own
- `employees` table — any employee records
- `service_posts` — all posts created by the client
- `interests` — all interests expressed by their business
- `bookings` — all bookings as client or business
- `payments` — all payment records
- `messages` — all messages sent
- `reviews` — all reviews submitted or received
- `cancellations` — any cancellations
- Sentry — any error reports containing their user ID
- PostHog — any analytics events tied to their user ID

### Step 4 — Prepare and send response (within 30 days total)

**For access requests:** Export data as a JSON or CSV file. Include all fields except fields that would reveal another user's private data (e.g., other user's messages are redacted).

**For deletion requests:**
- Soft-delete the user record (set a `deleted_at` timestamp, anonymize PII fields)
- Retain booking and payment records for 7 years (legal requirement)
- Remove from all marketing lists immediately
- Confirm deletion in writing to the requestor

**For correction requests:**
- Update the relevant data in the database
- Confirm in writing

**For export requests:**
- Same as access but package as a downloadable file

### Step 5 — Log the completion

Record the date the response was sent and the outcome. Keep this log for 2 years.

### DSAR 30-day clock

PIPEDA allows 30 days to respond. If more time is needed (complex request), notify the requestor within 30 days that an extension is needed and why, and provide a revised timeline.

---

## 7. Cross-border transfer notes

| Data category | Where processed | Notes |
|---|---|---|
| Primary database | Supabase ca-central-1 (Montreal, AWS) | Stays in Canada |
| Authentication | Supabase ca-central-1 | Stays in Canada |
| Error data | Sentry (US or EU depending on Sentry plan) | Partial stack traces; no PII policy in Sentry config |
| Payment data | Stripe (US) | PCI-certified; no raw card data leaves Stripe |
| Emails | Resend / SES / Postmark (US) | Transactional email content only; not stored long-term |
| Maps | Google Maps Platform (US) | Lat/lng coordinates sent on geo-browse requests |
| Push notifications | Expo + FCM (US) | Device token + notification text |

The primary concern is the database staying in Canada for PIPEDA compliance. ✅ That is confirmed via Supabase ca-central-1.

---

## 8. Logging policy

### What we log

- API authentication events (login, token refresh, logout, failed attempts)
- API request logs (route, status code, timestamp, user ID — no request body)
- Database query errors
- Payment events (booking created, escrow released, payout initiated)
- Security events (access denied, suspicious patterns)

### What we never log

- User passwords (ever — they are hashed before storage)
- Full credit card numbers or CVVs (Stripe handles; we never receive them)
- Full message content in access logs (messages are stored in the database but not logged to our observability tools)
- Authentication tokens in plaintext
- Personally identifiable information in error stack traces (Sentry is configured to scrub common PII patterns)

---

## 9. Retention schedule

| Data category | Retention | Basis |
|---|---|---|
| User account data | Until deletion + 30-day purge window | User request / PIPEDA |
| Booking and payment records | 7 years from transaction | CRA / financial law |
| Messages | 2 years from booking end | Business need |
| Reviews | Until account deletion | Business need |
| Application logs | 90 days rolling | Operational need |
| Error/crash data (Sentry) | 30 days rolling | Operational need |
| Marketing consent records | Until withdrawal + 2 years | CASL (Canada) |
| DSAR log | 2 years | Legal protection |
| Offboarding/access log | 3 years | Security audit |

---

## Cross-links

- [privacy-policy.md](privacy-policy.md) — user-facing privacy commitments
- [pipeda-compliance.md](pipeda-compliance.md) — compliance checklist
- [incident-response.md](incident-response.md) — what to do in a breach
- [security-checklist.md](security-checklist.md) — quarterly audit
