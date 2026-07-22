---
group: trust
project: swingby
hub: "[[MOC-Trust]]"
tags: [trust]
---
# Privacy and Security — SwingBy

> This folder contains SwingBy's public-facing legal documents and internal compliance operations.

---

## Who this is for

| Document | Audience |
|---|---|
| Privacy Policy | Users, regulators, lawyers |
| Terms of Service | Users, lawyers |
| Cookie Policy | Users, regulators |
| Security Overview | Users, partners, security-conscious customers |
| Vulnerability Disclosure | Security researchers |
| Subprocessors | Users, enterprise customers |
| Data Handling SOP | Internal team |
| PIPEDA Compliance | Internal team, lawyers |
| Incident Response | Internal team, on-call |
| Security Checklist | Internal team (quarterly audit) |
| DPA Template | Legal review before signing with any customer |

---

## Document index

### Public-facing

| File | Purpose | Status |
|---|---|---|
| [privacy-policy.md](privacy-policy.md) | What data we collect, why, and user rights | Draft — needs lawyer review |
| [terms-of-service.md](terms-of-service.md) | Rules of the platform, liability framing | Draft — needs lawyer review |
| [cookie-policy.md](cookie-policy.md) | What cookies and tracking we use | Draft |
| [security-overview.md](security-overview.md) | High-level security posture for users | Draft |
| [vulnerability-disclosure.md](vulnerability-disclosure.md) | How security researchers should report issues | Ready |
| [subprocessors.md](subprocessors.md) | Third-party vendors that handle user data | Ready |

### Internal

| File | Purpose | Review cadence |
|---|---|---|
| [data-handling.md](data-handling.md) | Data classification, access controls, DSAR SOP | Review quarterly |
| [pipeda-compliance.md](pipeda-compliance.md) | PIPEDA 10-principle checklist | Review annually |
| [incident-response.md](incident-response.md) | Breach response runbook | Review after every incident |
| [security-checklist.md](security-checklist.md) | Quarterly security audit | Run quarterly |
| [dpa-template.md](dpa-template.md) | Template DPA for subprocessors or enterprise clients | Review with counsel before signing |

---

## How this maps to legal requirements

### PIPEDA (Canada — primary)

Canada's federal private-sector privacy law. Applies to SwingBy as a commercial activity operating in Canada.

| Requirement | Where addressed |
|---|---|
| Privacy policy published | [privacy-policy.md](privacy-policy.md) |
| Consent mechanisms | [privacy-policy.md](privacy-policy.md) → Consent section |
| Data subject access requests | [data-handling.md](data-handling.md) → DSAR SOP |
| Breach notification | [incident-response.md](incident-response.md) → PIPEDA notification |
| 10 fair information principles | [pipeda-compliance.md](pipeda-compliance.md) |

### GDPR (EU — applicable if EU users sign up)

Relevant if any users sign up from EU countries (likely once the app is public).

| Requirement | Where addressed |
|---|---|
| Privacy policy with legal basis | [privacy-policy.md](privacy-policy.md) |
| Data processing agreements | [dpa-template.md](dpa-template.md) |
| Subprocessor list | [subprocessors.md](subprocessors.md) |
| User rights (erasure, portability) | [data-handling.md](data-handling.md) → DSAR SOP |

### CCPA (California — applicable to CA residents)

Relevant if California users use the platform.

| Requirement | Where addressed |
|---|---|
| Do Not Sell disclosure | [privacy-policy.md](privacy-policy.md) → CCPA section |
| Categories of data collected | [privacy-policy.md](privacy-policy.md) |

---

## Maintenance schedule

| Task | When |
|---|---|
| Review all public docs | Before each major product launch |
| Run security checklist | Every 90 days |
| Refresh subprocessors list | When adding any new vendor |
| Update PIPEDA compliance | Annually, or after any legal change |
| Review privacy policy | Annually, or after major feature additions |
| Test incident response | Tabletop exercise annually |

---

## Contact

- Privacy requests: privacy@swingbyy.com
- Security issues: security@swingbyy.com
- Legal: legal@swingbyy.com

<!-- graph-wire:start -->
---
**Up:** [[MOC-Trust]] · **Home:** [[SWINGBY]]

**Related:** [[cookie-policy]] · [[data-handling]] · [[dpa-template]] · [[incident-response]] · [[pipeda-compliance]] · [[privacy-policy]] · [[security-checklist]] · [[security-overview]] · [[subprocessors]] · [[terms-of-service]] · [[vulnerability-disclosure]]
<!-- graph-wire:end -->
