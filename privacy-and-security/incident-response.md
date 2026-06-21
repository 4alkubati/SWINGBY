# Incident Response Runbook

> For the SwingBy team. This is the playbook for security incidents, data breaches, and major outages.

**Last updated:** June 6, 2026  
**Owner:** Amr Alkubati (founder, primary on-call)  
**Backup:** TBD (add when first team member joins)

---

## Severity definitions

| Severity | Definition | Examples | Response SLA |
|---|---|---|---|
| **SEV1 — Critical** | Active breach, data loss, platform down, payment system compromised | Database exposed to public internet; unauthorized bulk data export; Stripe API key leaked; platform completely unavailable | Immediate (drop everything) |
| **SEV2 — High** | Significant security issue or widespread functional failure | A user can see another user's private data; authentication bypass found; payment calculations wrong for multiple bookings; API returning 500 on all requests | Within 1 hour |
| **SEV3 — Medium** | Localized security or reliability issue | One user reports a bug allowing them to view one booking they're not party to; elevated error rate on one endpoint; analytics not recording | Within 4 hours |
| **SEV4 — Low** | Minor security or reliability issue | Broken link in email; minor UI bug; one failed webhook delivery | Next business day |

---

## On-call roles

| Role | Who | Contact |
|---|---|---|
| Primary on-call | Amr Alkubati | [Phone / Telegram — add personal contact] |
| Backup on-call | TBD | TBD |
| Legal contact | [Lawyer name] | [Contact — TODO: engage a lawyer before launch] |
| PR contact | [N/A — founder handles] | N/A |

---

## Detection

Incidents are detected through:

1. **Sentry alerts** — error spikes, unhandled exceptions, performance degradation
2. **Uptime monitoring** — platform unavailability
3. **User reports** — in-app support, email to support@swingbyy.com
4. **Security researcher reports** — via security@swingbyy.com per [vulnerability-disclosure.md](vulnerability-disclosure.md)
5. **Supabase advisor alerts** — database-level anomalies
6. **Stripe alerts** — payment failures, chargeback spikes
7. **Manual discovery** — during development, code review, or routine audit

All detected incidents begin with the same first step: **assess severity and start the clock.**

---

## Response phases

### Phase 1 — Identify (target: within 15 minutes for SEV1/SEV2)

1. Who detected it, when, and how?
2. What is the scope? Which users are affected? Which data is at risk?
3. What is the severity level? Apply the definitions above.
4. Start the incident log (use the template in Phase 5 below).
5. Notify the backup on-call if this is SEV1 or SEV2.

**Questions to answer quickly:**
- Is the attack active or historical?
- Is any data currently being exfiltrated?
- Is the platform usable?
- Is payment processing affected?

---

### Phase 2 — Contain (target: within 1 hour for SEV1/SEV2)

**Containment goals:** Stop the bleeding. Do not worry about root cause yet.

Common containment actions:

| Scenario | Containment action |
|---|---|
| Leaked API key (Stripe, Supabase service role) | Rotate key immediately in provider dashboard. Update environment variable in hosting platform. Redeploy backend. |
| User data exposed via API bug | Disable the affected endpoint (return 503 with a maintenance message). Log who queried it. |
| Database exposed publicly | Enable Supabase's network restriction settings immediately. Check RLS policies. |
| Account takeover (user reports) | Disable the affected account. Force token revocation. |
| Platform-wide outage | Check hosting provider status page. Scale up if needed. Revert last deployment if correlated. |
| Active brute force | Enable IP-based rate limiting in Supabase Auth. |

Document every containment action taken with the timestamp.

---

### Phase 3 — Eradicate (target: within 4 hours for SEV1/SEV2)

Remove the root cause. This often requires:
- A code fix (patching the vulnerability)
- A configuration change (removing over-permissive access)
- A credential rotation (all keys touched by the incident)
- Dependency update (if a package vulnerability was exploited)

Do not re-enable affected functionality until the root cause is confirmed removed.

If the root cause requires a significant code change, deploy to a staging environment first, verify, then promote to production.

---

### Phase 4 — Recover (target: service restored within 24 hours for SEV1/SEV2)

1. Restore or re-enable affected services.
2. Monitor closely for 24 hours post-recovery.
3. Confirm no data loss or corruption.
4. Notify affected users (see Communications below).
5. File required regulatory notifications (see PIPEDA section below).
6. Update the incident log with resolution details.

---

### Phase 5 — Learn (within 7 days of resolution)

Conduct a blameless post-incident review. The goal is to prevent recurrence, not to assign fault.

**Post-incident review template:**

```
## Incident Review — [Incident ID] — [Date]

**Severity:** SEV[N]
**Duration:** [Start time] → [Resolution time]
**Users affected:** [Count or description]
**Data at risk:** [What data, if any]

### Timeline
[Chronological log of detection, actions, and resolution]

### Root cause
[What caused this? Be specific.]

### What went well
[What detection, response, or tooling worked correctly?]

### What could be better
[What slowed down the response? What was unclear?]

### Action items
| Action | Owner | Due date |
|---|---|---|
| [Specific change] | [Name] | [Date] |
```

File the completed review in a private incident log (Notion, internal docs, or a private git repo). Keep it internal.

---

## Communications

### Internal Slack template (post within 15 minutes of SEV1/SEV2 detection)

```
:rotating_light: INCIDENT DECLARED — SEV[N]

Time: [HH:MM MT]
Detected by: [who/how]
Affected: [what is broken or exposed]
Initial assessment: [1-2 sentences on scope]
Status: Investigating

Next update in 30 minutes.
```

### External user-facing template (post only if user data was accessed or service is significantly impacted)

**Communication channels (in order of priority):**

1. **Email** to affected users via Resend (primary — required for regulatory notification under PIPEDA where personal data is involved)
2. **In-app banner** on the next session start
3. **Twitter / X** — [@swingbyca](https://twitter.com/swingbyca) — for public awareness and ongoing updates
4. **Instagram** — [@swingbyca](https://instagram.com/swingbyca) — story post linking to a full statement on the website
5. **Status page** — `/status` updated with incident summary and ongoing updates

The same wording goes to all channels (no inconsistencies). Twitter and Instagram are the public-facing channels we expect users to check first; email is the channel of record for regulatory and legal purposes. All external comms drafts are reviewed by counsel before posting if the incident involves a confirmed breach of personal data.

Generic template:

```
Subject: Important security notice from SwingBy

We are writing to inform you of a security incident that may have affected your account.

What happened: [Plain language description — what occurred, when, and what data was potentially involved]

What data is affected: [Specific categories — e.g., "email address and booking history" — be precise]

What we have done: [Actions taken to contain and remediate]

What you should do: [Any user action required — e.g., change password, monitor for phishing]

We take the security of your data seriously and apologize for this incident.

[Name], SwingBy
```

Do not send external communications before the incident is contained. Do not exaggerate or minimize.

---

## PIPEDA breach notification

Under PIPEDA (and Alberta PIPA), if a breach creates a **real risk of significant harm** to individuals, SwingBy must:

1. **Notify the Privacy Commissioner of Canada** as soon as feasible — treat 72 hours as the target.
2. **Notify affected individuals** directly, also as soon as feasible.
3. **Maintain a breach record** for 24 months.

"Significant harm" includes: identity theft, financial loss, physical safety risk, damage to reputation, humiliation, or loss of employment.

**Notification to the Privacy Commissioner:**
- Submit via the OPC breach reporting form at priv.gc.ca
- Include: nature of information, number of individuals affected, description of circumstances, steps taken, and whether individuals have been notified

**Exemption:** If the breach is contained and there is no real risk of harm, formal notification may not be required — but maintain a record anyway. Consult legal counsel before deciding not to notify.

---

## Escalation thresholds

| Situation | Escalation |
|---|---|
| User financial data potentially accessed | Contact lawyer within 24 hours |
| Significant press inquiry about a security issue | Do not respond without PR/legal guidance |
| Regulatory inquiry from OPC | Contact lawyer immediately |
| Breach involving more than 100 users' PII | Contact lawyer and OPC within 72 hours |
| Any criminal activity (hacking, extortion) | Contact local law enforcement. Do not pay ransom. |

---

## Post-incident checklist

- [ ] Incident log complete with full timeline
- [ ] Root cause identified and documented
- [ ] Affected users notified (if applicable)
- [ ] OPC notified (if required under PIPEDA)
- [ ] All compromised credentials rotated
- [ ] Sentry alert rules updated if detection was delayed
- [ ] Post-incident review scheduled within 7 days
- [ ] Action items assigned with due dates
- [ ] Breach record filed (24-month retention)
