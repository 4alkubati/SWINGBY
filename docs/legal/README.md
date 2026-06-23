# docs/legal/

Dev-facing copies of the production legal docs. Grouped here so anyone
reading `docs/` finds the legal surface in one place.

## Files
- `PRIVACY_POLICY.md` — what we collect, how we use it, retention.
- `TERMS_OF_SERVICE.md` — user agreement, dispute resolution, payment terms.

## Other locations for the same content
The same material — in different formats — also lives at:

| Location | Purpose |
|---|---|
| `privacy-and-security/privacy-policy.md` + `terms-of-service.md` | Full legal-program docs (alongside PIPEDA compliance, incident response, etc.) |
| `web/launch/src/pages/PrivacyPage.jsx` + `TermsPage.jsx` | Live pages served at `swingbyy.com/privacy` and `/terms` |
| App Store + Play Store privacy disclosures | Auto-imported by reviewers |

When updating, change all three. Whichever you edit, search-and-replace the others.
