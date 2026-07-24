# docs/legal/

> **These two files are POINTERS, not the legal documents.** As of 2026-07-23
> the canonical privacy policy and terms of service live in
> `privacy-and-security/`. The copies that used to live here (dated 28 May 2026)
> were retired because two canonical documents drifted apart and contradicted
> each other and the shipped code.

## Where the real documents are

| Document | Canonical home |
|---|---|
| Privacy Policy | [`privacy-and-security/privacy-policy.md`](../../privacy-and-security/privacy-policy.md) |
| Terms of Service | [`privacy-and-security/terms-of-service.md`](../../privacy-and-security/terms-of-service.md) |

`PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` in this folder now contain only a
pointer to the canonical file plus a record of what was merged out of the
retired copy. Do not re-add document text here.

## Derived surfaces (regenerate from canonical, never edit independently)

| Location | Purpose |
|---|---|
| `mobile/src/screens/profile/PrivacyPolicyScreen.js` | in-app privacy summary + link |
| `mobile/src/screens/shared/TermsOfServiceScreen.js` | in-app terms summary + link |
| `web/launch/src/pages/PrivacyPage.jsx` + `TermsPage.jsx` + `CookiesPage.jsx` | launch-site summaries (intended for `swingbyy.com/privacy` etc.) |
| `web/pre-launch/src/pages/PrivacyPage.jsx` + `TermsPage.jsx` | **what swingbyy.com currently serves — stale, dated "May 2025"** |
| App Store + Play Store privacy disclosures | must match the canonical policy |

When the canonical documents change, update every derived surface. See
`privacy-and-security/COMPLIANCE-REGISTER.md` section H for the publish state of
each surface.
