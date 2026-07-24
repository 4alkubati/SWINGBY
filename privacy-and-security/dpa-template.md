# Data Processing Agreement — Template

> This is a template. Review with legal counsel before signing with any subprocessor or enterprise client.
> Last updated: June 6, 2026

---

## IMPORTANT NOTICE

This document is a starting template for Data Processing Agreements (DPAs). It is designed to be consistent with PIPEDA (Canada), GDPR (EU), and general commercial practice. It is not a substitute for legal advice. Before signing any version of this agreement, have it reviewed by a lawyer qualified in Canadian privacy law.

---

## DATA PROCESSING AGREEMENT

This Data Processing Agreement ("DPA") is entered into between:

**Controller (or Processor):** [Company Name], [registered address] ("Controller")

and

**`[[LEGAL_ENTITY_NAME — Kira to supply]]`**, `[[REGISTERED_ADDRESS — Kira to supply]]`, Calgary, Alberta, Canada ("SwingBy" / "Processor")

as of the date last signed below.

This DPA forms part of the Main Agreement between the parties (the "Agreement"). In the event of conflict, this DPA takes precedence over the Agreement on privacy and data protection matters.

---

## 1. Definitions

**"Personal Data"** means any information relating to an identified or identifiable natural person.

**"Processing"** means any operation performed on Personal Data, including collection, storage, use, disclosure, or deletion.

**"Data Subject"** means the individual whose Personal Data is being processed.

**"Applicable Privacy Law"** means PIPEDA, Alberta PIPA, GDPR, and any other applicable privacy or data protection legislation.

**"Security Incident"** means any unauthorized access to, use of, or disclosure of Personal Data.

---

## 2. Subject matter and purpose

SwingBy processes Personal Data on behalf of the Controller for the purpose of providing the services described in the Agreement, including:

- [List specific services — e.g., "operating the SwingBy marketplace platform through which Controller's users book and pay for services"]

SwingBy acts as a **Processor** with respect to Personal Data for which Controller is the **Controller**, as those terms are defined under applicable privacy law.

Where SwingBy processes Personal Data for its own purposes (e.g., platform operations, security, analytics), SwingBy acts as a Controller independently.

---

## 3. Instructions for processing

SwingBy shall process Personal Data only:

- In accordance with Controller's documented instructions
- As necessary to provide the services under the Agreement
- As required by applicable law (in which case SwingBy shall inform Controller before processing unless prohibited by law)

Controller acknowledges that SwingBy's standard platform operations (as described in SwingBy's Privacy Policy) constitute documented instructions for the purpose of this DPA.

---

## 4. Confidentiality

SwingBy shall ensure that persons authorized to process Personal Data are bound by confidentiality obligations and have access only to the Personal Data necessary for their role.

---

## 5. Security measures

SwingBy shall implement and maintain technical and organizational measures to protect Personal Data against unauthorized access, loss, or destruction. Current measures are described in SwingBy's [Security Overview](security-overview.md).

These measures include, at minimum:

- Encryption of data in transit (TLS 1.2+)
- Encryption of data at rest (AES-256)
- Access controls with authentication and role-based permissions
- Row Level Security (RLS) on all database tables
- Incident detection and monitoring via Sentry
- Regular security reviews

SwingBy may update these measures over time. Any changes that materially reduce the security of Personal Data will be communicated to Controller with at least 30 days notice.

---

## 6. Subprocessors

SwingBy uses subprocessors to provide its services. The current list of subprocessors is maintained at [subprocessors.md](subprocessors.md).

SwingBy shall:
- Impose equivalent data protection obligations on all subprocessors
- Remain liable to Controller for the acts or omissions of its subprocessors
- Notify Controller of any planned changes to its subprocessor list with at least 30 days advance notice

Controller may object to a new subprocessor within 30 days of notification. If Controller's objection is not resolved, either party may terminate the relevant services with reasonable notice.

---

## 7. Data subject rights

To the extent SwingBy receives a Data Subject request (access, correction, deletion, portability, or objection) that relates to Personal Data processed on behalf of Controller, SwingBy shall:

- Forward the request to Controller within 5 business days
- Provide reasonable technical assistance to help Controller respond

Where SwingBy is the Controller (e.g., for its own users' data), SwingBy shall handle Data Subject requests directly in accordance with its Privacy Policy.

---

## 8. Security incidents

In the event of a Security Incident involving Personal Data, SwingBy shall:

- Notify Controller without undue delay and, where feasible, within 72 hours of becoming aware
- Provide sufficient information for Controller to meet its notification obligations under applicable law

Notification shall include:
- Nature of the incident (categories and approximate number of individuals affected)
- Likely consequences of the incident
- Measures taken or proposed to address the incident

---

## 9. Data retention and return

Upon termination of the Agreement, SwingBy shall, at Controller's election:

- Return Personal Data to Controller in a machine-readable format, or
- Securely delete or destroy Personal Data

Within 30 days of termination, SwingBy shall confirm in writing that deletion or return is complete.

SwingBy may retain Personal Data for longer periods where required by applicable law (e.g., financial records for 6 years from the end of the tax year they relate to, under the Canadian Income Tax Act s.230(4)). Such retained data will be clearly isolated and not used for any other purpose.

---

## 10. Audits and certifications

SwingBy shall provide Controller with information necessary to demonstrate compliance with this DPA, including:

- Copies of relevant security policies and certifications upon written request
- Reasonable cooperation with Controller audits, provided Controller gives at least 30 days written notice and bears reasonable costs

Audits shall be conducted during normal business hours and shall not unreasonably disrupt SwingBy's operations.

---

## 11. Data transfers

SwingBy's primary data storage is in Canada (Supabase, ca-central-1). Where Personal Data is transferred to subprocessors in other jurisdictions (e.g., Stripe in the US, Sentry in the US), SwingBy ensures appropriate transfer mechanisms are in place, including:

- Standard contractual clauses (EU)
- Data processing agreements with US subprocessors
- Adequacy-based transfers where applicable

A full transfer breakdown is in [subprocessors.md](subprocessors.md).

---

## 12. Governing law

This DPA is governed by the laws of the Province of Alberta and the federal laws of Canada. Disputes shall be resolved in accordance with the dispute resolution provisions of the Agreement.

---

## 13. Term

This DPA is effective from the date of the Agreement and continues until the Agreement is terminated.

---

## Signatures

**Controller:**

Signed by: ___________________________  
Name: ________________________________  
Title: ________________________________  
Date: ________________________________  
Company: _____________________________

**`[[LEGAL_ENTITY_NAME — Kira to supply]]`:**

Signed by: ___________________________  
Name: ________________________________  
Title: ________________________________  
Date: ________________________________

---

*TEMPLATE — Review with counsel before signing. `[[LEGAL_ENTITY_NAME — Kira to supply]]` — Calgary, Alberta, Canada.*
