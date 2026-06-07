# 09 — Brand Guidelines

> Visual + verbal identity. Anything we publish should pass these rules.

---

## Brand essence

> **"The trust layer for local services."**

We are the calm, competent neighbour that makes the marketplace work for both sides. Not the loudest, not the cheapest, not the flashiest. The most trustworthy.

---

## Voice

| | Do | Don't |
|---|---|---|
| **Tone** | Warm, direct, confident | Salesy, hypey |
| **Stance** | Pro-small-business, pro-customer | Anti-anything |
| **Vocabulary** | service, business, client, book, post, neighbour | vendor, user, buyer, transact, leverage, synergy |
| **Length** | Short sentences. One idea per sentence. | Run-ons, jargon-filled paragraphs |
| **Pronouns** | "We" (company), "you" (reader) | "One should…" |
| **Emoji** | OK on social. Never in transactional emails. | Strings of emoji as personality |
| **CTAs** | "Book now," "Post a job," "Get started" | "Unlock," "Discover," "Revolutionize" |

---

## Word list (use these)

✅ neighbourhood, local, trusted, vetted, simple, fast, safe, fair, transparent, near you, in minutes, get started, book, post, hire, find, escrow

## Word list (avoid these)

❌ revolutionary, disrupt, synergy, unlock, leverage, ecosystem, paradigm, supercharge, ninja, guru, game-changing, world-class, best-in-class

---

## Logo

**Files:** `marketing/assets/logos/` (TODO: populate)

| Variant | Use when |
|---|---|
| `swingby-wordmark-light.svg` | Dark backgrounds |
| `swingby-wordmark-dark.svg` | Light backgrounds |
| `swingby-mark-only.svg` | App icon, favicon, small spaces |
| `swingby-horizontal-light.svg` | Email headers, banners |

**Clear space:** at least the height of the "S" character around the logo on all sides.
**Minimum size:** 24px tall (mark only) or 80px wide (wordmark).
**Never:** rotate, stretch, change colors, add effects, place on busy photos without overlay.

---

## Color palette

Pulled from `web/pre-launch/src/theme/tokens.css`. Do not invent new colors.

| Role | Hex | Use |
|---|---|---|
| Primary | TBD (open `tokens.css`) | Primary buttons, links, brand accents |
| Secondary | TBD | Secondary CTAs, highlights |
| Surface | TBD | Cards, panels |
| Background | TBD | Page background |
| Text — primary | TBD | Body |
| Text — muted | TBD | Captions, metadata |
| Success | #16a34a (or token) | Confirmations |
| Warning | #f59e0b | Cautions |
| Error | #dc2626 | Errors, failures |

**TODO:** sync this table with the actual values in `web/pre-launch/src/theme/tokens.css`.

---

## Typography

Pulled from `web/pre-launch/src/theme/typography.css`.

| Use | Family | Weight | Size (px) |
|---|---|---|---|
| Display | (per typography.css) | 700 | 48-72 |
| H1 | same | 700 | 36 |
| H2 | same | 600 | 28 |
| H3 | same | 600 | 22 |
| Body | same | 400 | 16 |
| Small | same | 400 | 14 |
| Tiny | same | 400 | 12 |

Never use more than 3 weights in a single layout. Never set body text below 14px.

---

## Photography & illustration style

| Do | Don't |
|---|---|
| Real people, real Calgary backdrops | Stock photo "diverse business team smiling at laptop" |
| Natural light | Flat studio lighting |
| Candid action — someone *doing* the service | Posed handshakes |
| Local landmarks subtle in background | Tourist clichés (Stampede only when topical) |
| Diverse trades, all genders, all ages | Generic models |

---

## Iconography

Use Lucide (already used in web). One stroke weight (1.5px). Filled icons only for status badges (verified, completed). Avoid mixing icon libraries.

---

## Animation

Minimal. Where we use it:
- Page transitions: 200ms ease-out fade
- Button hover: 100ms scale (1.02) + color
- Empty state illustrations: 1 subtle loop, not continuous
- Confetti on first booking: yes (once per user, never again)

No bouncing CTAs. No autoplay video with sound. No parallax scroll effects.

---

## Photography sources (when we need stock)

- Unsplash (preferred — search "Calgary," "Alberta," real trades)
- Pexels (backup)
- AI gen (DALL-E / Midjourney) only for hero illustrations, never as "real photos" of people

---

## App icon

1024×1024 master. Bold, recognizable at 60×60. High contrast. Mark only (no wordmark — doesn't read at small size).

---

## Email templates

Already started in `web/pre-launch/docs/email_templates/`:
- `confirm_signup.html`
- `magic_link.html`
- `reset_password.html`

**Conventions:**
- Plain HTML, no fancy CSS. Tested in dark mode.
- Logo top-left, 32px tall
- One CTA per email, prominent button
- Preview text + plain-text fallback for every email
- Unsubscribe link in footer of every marketing email (CASL requirement)

---

## Social media profile assets

| Platform | Profile pic | Cover | Bio |
|---|---|---|---|
| Instagram | mark only | n/a | one-liner + Calgary 📍 + waitlist link |
| TikTok | mark only | n/a | one-liner + link |
| LinkedIn | wordmark | branded banner | full company description |
| Twitter/X | mark only | branded banner | one-liner + link |
| Facebook | wordmark | branded banner | full company description |

---

## Press kit (for journalists)

Live at: `web/pre-launch/public/press-kit/` (TODO).

Contents:
- Logo pack (.zip with all variants in SVG/PNG)
- App screenshots (10 high-res PNGs)
- Founder headshot + bio (200 words)
- One-pager PDF (company summary, traction, contact)
- Boilerplate "About SwingBy" 100-word paragraph

---

## Anti-patterns we'll catch in review

- "Sign up now!" (use "Get started" or "Join the waitlist")
- Three exclamation marks in one paragraph
- Emoji strings ("🚀🚀🚀")
- "We're the Uber of X"
- Hero photos with stock-photo people
- Buttons with vague labels ("Click here," "Learn more")
- "Disruptive," "revolutionary," "game-changing"
- Walls of text without H2/H3 breaks
- All-caps in body copy
