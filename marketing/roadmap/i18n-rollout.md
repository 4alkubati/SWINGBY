---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# Roadmap: Internationalization (i18n) Rollout

> Status: Scaffold complete (EN/FR/AR keys exist)  
> Owner: TBD  
> See also: `mobile/src/i18n.js`, `web/launch/src/locales/`

---

## Language Priority Order

Based on 2021 Calgary Census data (City of Calgary Community Profiles) and Alberta Immigration data:

| Priority | Language | Code | Calgary Population | Notes |
|---|---|---|---|---|
| 1 | English | `en` | ~85% primary | Default, already complete |
| 2 | French | `fr-CA` / `fr` | ~3% primary, ~15% second-lang | Federal bilingualism; already complete in mobile |
| 3 | Arabic | `ar` | ~4% of non-English speakers; fastest-growing | RTL required; mobile keys added 2026-06-13 |
| 4 | Tagalog | `tl` | ~6% of immigrants | Large Filipino community in NE Calgary |
| 5 | Mandarin | `zh-Hans` | ~5% of immigrants | Simplified Chinese; common in NW |
| 6 | Punjabi | `pa` | ~3% of immigrants | Large South Asian community |
| 7 | Spanish | `es` | ~2% | Growing with Latin American immigration |
| 8 | Hindi | `hi` | ~2% | Overlap with Punjabi community |

> Source: Calgary 2021 Census Profile + CIC Alberta settlement data.

---

## Current State (as of 2026-06-13)

| Layer | EN | FR | AR | TL | ZH | PA |
|---|---|---|---|---|---|---|
| Mobile (i18n-js) | ✅ Full | ✅ Full | ✅ Scaffold | ❌ | ❌ | ❌ |
| Web launch (i18next) | ✅ Hero/nav/footer | 🟡 Hero/nav/footer | 🟡 Hero/nav/footer | ❌ | ❌ | ❌ |
| Web admin | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Emails | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Push notifications | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Translation Pipeline

### Phase 1 — Machine-assisted (EN → all)

1. Export all JSON key files from `web/launch/src/locales/en.json` and `mobile/src/i18n.js`.
2. Use DeepL Pro API or Google Cloud Translation API for a first pass.
3. Tag all machine-translated strings with `// MT` for reviewer attention.

### Phase 2 — Community reviewer

| Language | Recommended reviewer path |
|---|---|
| FR | Hire a bilingual Canadian freelancer (Upwork, LinkedIn) |
| AR | Arabic-speaking community member; SwingBy network |
| TL | Filipino community organizations in Calgary |
| ZH | Mandarin-speaking student at UCalgary or MRU |

**Reviewer rate estimate:** 0.07–0.12 CAD/word for proofreading MT output.

### Phase 3 — Ongoing maintenance

- Use `i18next-scanner` in CI to flag missing keys when new UI is added.
- One language reviewer per PR that adds or changes UI text.
- Monthly diff email to translators when the EN key file changes.

---

## RTL (Right-to-Left) Requirements for Arabic

- Web: add `dir="rtl"` to `<html>` when locale is `ar`. Use CSS logical properties (`margin-inline-start` not `margin-left`).
- Mobile: React Native handles RTL automatically when `I18nManager.forceRTL(true)` is called. Wire this in `mobile/src/i18n.js` when `setLocale('ar')` is called.
- Flip icons that have directionality (arrows, chevrons).
- Date/number formatting: Arabic-Indic numerals optional; Western numerals are generally accepted in bilingual Calgary Arabic community.

---

## Email Translation

- Transactional emails (booking confirmation, quote received, etc.) need a `preferred_language` field on the `users` table.
- Template engine: already using HTML email templates in `marketing/email-templates/`. Convert them to Handlebars/Jinja with `{{t 'booking.confirmed'}}` syntax.
- SendGrid supports Dynamic Templates with locale fallback — use that rather than storing separate templates per language.

---

## Timeline Estimate

| Milestone | Effort | Target |
|---|---|---|
| Full web/launch EN→FR translation | 2 days | Q3 2026 |
| AR RTL web implementation | 3 days | Q3 2026 |
| Mobile TL + ZH scaffold | 1 day | Q4 2026 |
| Email translation (FR + AR) | 1 week | Q4 2026 |
| Full TL + ZH review | 2 weeks | Q1 2027 |

---

## Open Questions

- Do we offer Arabic-language customer support? (Phone/chat vs. app-only.)
- Should the app auto-detect locale or require explicit selection on signup?
- Does the business-facing dashboard need Arabic? (Most Calgary business owners are English-primary even if clients are Arabic-speaking.)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
