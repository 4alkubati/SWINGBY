# Support Escalation Matrix

---

## Tier 1 — Handle immediately (no escalation needed)

These are handled by first-line support (or founder if solo):

| Issue type | Action |
|---|---|
| Account locked / can't log in | Use template T01. Manual unlock if needed. |
| Confirmation email not received | Manually confirm account. Use template T02. |
| Password reset not working | Trigger manual reset from admin panel. |
| Payment failed | Walk through card retry steps. Use template T05. |
| App technical issue | Triage with templates T16–T18. Log in issue tracker. |
| General product questions | Answer from knowledge base. |
| Business profile not visible | Check account status. Use template T18. |
| Complaint about UX | Acknowledge. Log feedback. No escalation. |

**Response SLA:** 4 hours during business hours, 24 hours otherwise.

---

## Tier 2 — Escalate to senior support / founder within 4 hours

| Issue type | Who handles | Action required |
|---|---|---|
| Payment charged but booking not confirmed | Founder | Manually reconcile payment + booking status. |
| Payout not received (business) | Founder | Check Stripe dashboard. Initiate manual release if needed. |
| Refund request (within policy) | Senior support | Issue refund per policy. Document in case log. |
| Client says work wasn't done | Senior support | Open dispute. Hold escrow. Gather evidence. |
| Business says client dispute is false | Senior support | Open dispute. Neutral investigation. |
| Business didn't show up | Founder | Refund client. Flag business. Log incident. |
| Review removal request | Founder | Assess against content policy. |

**Response SLA:** 2 hours for payment issues, 4 hours for disputes.

---

## Tier 3 — Founder must handle personally

| Issue type | Why founder | Action |
|---|---|---|
| Safety concern | Platform reputation + legal exposure | Respond within 1 hour. Follow safety playbook. Police if needed. |
| Threat of legal action | Legal exposure | Escalate to legal counsel if beyond small claims. Do not engage substantively via support email. |
| Media inquiry | Reputation | Handle personally or via PR contact. |
| Stripe account frozen / payout halted | Platform survival | Contact Stripe directly. All new bookings may need manual processing. |
| Data breach or security incident | PIPEDA obligation | 72-hour notification window. Follow `docs/testing/disaster-recovery-drill.md`. |
| Fraud pattern detected (multiple fake accounts) | Integrity | Suspend accounts. Investigate. Consider law enforcement if above $1,000 CAD. |
| Business account suspension appeal | Judgment call | Only founder can permanently suspend or reinstate. |

**Response SLA:** Immediate (same day, regardless of hour).

---

## When to call legal

> TODO (HUMAN): Insert name + contact info of your legal counsel here.

Involve legal counsel when:

- A user explicitly mentions a lawyer, lawsuit, or legal action
- A dispute involves > $5,000 CAD
- A safety incident involved actual harm (physical, financial above $1,000)
- A government regulator (CRTC, PIPEDA/OPC) contacts SwingBy
- A journalist is asking about a specific incident
- You receive a formal legal notice (cease-and-desist, subpoena)

**Do NOT:** engage substantively in writing on any matter where legal action is threatened. Say "we're taking this seriously and our team will be in touch" and stop the email thread immediately.

---

## Escalation channels

| Channel | For |
|---|---|
| support@swingbyapp.com | All inbound support |
| Internal Slack #support-urgent | High-urgency issues between team members |
| Founder direct (phone/text) | Tier 3 issues only |
| Stripe support | Payment/payout issues that can't be resolved from dashboard |
| Supabase support | Database or auth platform issues |

---

## Decision authority

| Decision | Who can make it |
|---|---|
| Issue refund (within policy) | Any support agent |
| Issue refund (outside policy) | Founder only |
| Suspend business account (temporary, 7 days) | Senior support |
| Permanently suspend any account | Founder only |
| Remove a review | Founder only |
| Close a dispute in favor of client | Senior support |
| Close a dispute in favor of business | Founder review recommended |
| Respond to media | Founder only |
| Accept legal service of process | Founder only |
