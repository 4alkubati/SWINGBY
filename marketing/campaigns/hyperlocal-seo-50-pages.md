---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# Hyperlocal SEO — 50-Page Calgary Build Plan

## Overview

5 categories × 10 neighbourhoods = 50 SEO landing pages targeting hyper-specific local searches.

Each page ranks for: `[category] in [neighbourhood] Calgary` and related long-tail variants.  
Built on the `/calgary/:neighbourhood/:category` route in `web/launch/`.  
Content lives in `web/launch/src/data/seo-content.js`.

---

## Categories (5)

| Slug | Display name | Target intent |
|---|---|---|
| `house-cleaning` | House Cleaning | "cleaners near me," "house cleaning Beltline" |
| `handyman` | Handyman | "handyman Mission," "home repairs Calgary" |
| `dog-walking` | Dog Walking | "dog walker Kensington," "dog walking near me" |
| `personal-training` | Personal Training | "personal trainer Inglewood," "in-home trainer Calgary" |
| `lawn-care` | Lawn Care | "lawn care Bridgeland," "grass cutting Calgary" |

---

## Neighbourhoods (10)

| Slug | Display name | Postal prefix |
|---|---|---|
| `beltline` | Beltline | T2R |
| `mission` | Mission | T2S |
| `kensington` | Kensington | T2N |
| `inglewood` | Inglewood | T2G |
| `ramsay` | Ramsay | T2G |
| `bridgeland` | Bridgeland | T2E |
| `hillhurst` | Hillhurst | T2N |
| `bankview` | Bankview | T2T |
| `killarney` | Killarney | T3E |
| `erlton` | Erlton | T2G |

---

## Full 50-page matrix

| | house-cleaning | handyman | dog-walking | personal-training | lawn-care |
|---|---|---|---|---|---|
| **Beltline** | ✅ Done | ✅ Done | — | — | — |
| **Mission** | ✅ Done | ✅ Done | ✅ Done | — | — |
| **Kensington** | ✅ Done | ✅ Done | ✅ Done | — | — |
| **Inglewood** | — | — | ✅ Done | ✅ Done | — |
| **Ramsay** | ✅ Done | — | — | — | — |
| **Bridgeland** | — | ✅ Done | — | — | ✅ Done |
| **Hillhurst** | — | — | — | — | ✅ Done |
| **Bankview** | — | ✅ Done | — | — | — |
| **Killarney** | — | — | — | — | ✅ Done |
| **Erlton** | ✅ Done | — | — | — | — |

**Current coverage:** 17/50 pages built. 33 remaining.

---

## Target keywords per combo (examples)

### Beltline × House Cleaning
- "house cleaning Beltline Calgary"
- "cleaners near 17th Ave SW Calgary"
- "condo cleaning Beltline"
- "house cleaner T2R"
- "weekly cleaning service Beltline"

### Mission × Handyman
- "handyman Mission Calgary"
- "home repairs Mission SW"
- "handyman near Stanley Park Calgary"
- "fix it services Mission Calgary"

### Kensington × Dog Walking
- "dog walker Kensington Calgary"
- "dog walking near Kensington Road NW"
- "dog walkers T2N Calgary"

*(Expand for each combo as pages are built)*

---

## Content ramp cadence

| Phase | Pages | Timeline | Target |
|---|---|---|---|
| Phase 1 (current) | 17 pages live | June 2026 | Indexing, initial ranking |
| Phase 2 | +13 pages (to 30) | July 2026 | Target all 10 hoods × 3 categories |
| Phase 3 | +10 pages (to 40) | August 2026 | Add remaining categories |
| Phase 4 | +10 pages (to 50) | September 2026 | Full 5×10 matrix complete |

---

## How to add a new page

1. Add an entry to `web/launch/src/data/seo-content.js` with key `'neighbourhood-slug-category-slug'`.
2. Include: `intro` (200+ words), `faqs` (5 items), `cta` (button text).
3. Add the URL to `web/launch/public/sitemap.xml`.
4. Update the matrix above.
5. The route already exists — no code changes needed.

---

## SEO notes

- Each page has JSON-LD `Service` schema + `FAQPage` schema (auto-rendered by `LocationCategoryPage.jsx`).
- Title tag format: `[Category] in [Neighbourhood], Calgary — SwingBy`
- Meta description: auto-generated from category + neighbourhood if custom not provided.
- Internal links: `CalgaryPage.jsx` should link to each neighbourhood × category combo.

> TODO (HUMAN): Update `CalgaryPage.jsx` to render a grid of neighbourhood × category links once 20+ pages are live.
> TODO (HUMAN): Submit sitemap to Google Search Console after each batch of new pages.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
