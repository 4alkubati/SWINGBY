# Cookie Policy

**Effective date:** June 6, 2026  
**Last updated:** June 6, 2026

---

## Overview

SwingBy uses cookies and similar technologies to make the platform work, to understand how you use it, and to improve your experience. This policy explains what we use, why, and how you can control it.

---

## What are cookies?

Cookies are small text files stored on your device when you visit a website or use a web-based application. They allow the site to remember information about your visit, such as your login status or preferences.

Similar technologies include:
- **Local storage** — used in the mobile app and web app to store session data
- **Session tokens** — used for authentication (Supabase session tokens)
- **Pixel tags / web beacons** — small image files used by analytics tools to track page views

---

## Categories of cookies we use

### 1. Strictly necessary

These cookies are essential for the platform to function. You cannot opt out of them.

| Cookie / Storage | Purpose | Expires |
|---|---|---|
| `sb-access-token` | Supabase authentication — keeps you logged in | Session (expires after 1 hour; refreshed automatically) |
| `sb-refresh-token` | Supabase session refresh — refreshes your access token | 7 days |
| `csrf_token` | CSRF protection for API requests | Session |
| App local storage | Stores UI state (e.g., current screen, onboarding progress) | Until cleared |

These are set by our own infrastructure (Supabase Auth and FastAPI backend). Without them, login and core app functionality will not work.

---

### 2. Functional

These cookies enhance your experience but are not strictly required.

| Cookie / Storage | Purpose | Expires |
|---|---|---|
| `user_preferences` | Stores display preferences (e.g., map vs. list view) | 1 year |
| `last_location` | Stores your last-used location for faster geo-browse loading | 30 days |

You can disable these by clearing app storage. Features that depend on them may not work as expected.

---

### 3. Analytics

These cookies help us understand how users use the platform so we can improve it. They do not identify you personally.

| Tool | What it tracks | Data sent to | Opt-out |
|---|---|---|---|
| PostHog | Page views, button clicks, feature usage, funnel steps, session recording (no PII) | PostHog cloud or self-hosted | Opt out via cookie banner |
| Plausible (or Umami) | Page views, referrers, device type — no PII, no fingerprinting | Plausible cloud or self-hosted | Opt out via cookie banner |
| Sentry | JavaScript errors, crash reports — may include partial URL or stack trace | Sentry (US/EU) | Contact privacy@swingby.ca |

> TODO (HUMAN): Confirm which analytics tools are in production before publishing. Update this table accordingly.

Analytics cookies are only set with your consent (where required by law). You can withdraw consent at any time.

---

### 4. Marketing

These cookies are used to measure the effectiveness of paid ad campaigns. We do not use them to serve ads on SwingBy — we use them only to attribute which ad campaign led to a signup.

| Cookie | Purpose | Expires |
|---|---|---|
| `_ga`, `_gid` | Google Analytics — ad attribution | 2 years / 24h |
| `_fbp` | Meta Pixel — Facebook/Instagram ad attribution | 90 days |
| UTM parameters | Stored in our own database on signup to attribute channel | Permanent (stored with your account, not re-sent) |

Marketing cookies require your explicit consent and are only set if you accept them in the cookie consent banner.

---

## How to manage cookies

### Browser-level controls

Most browsers allow you to block or delete cookies through their settings. Note that blocking strictly necessary cookies will prevent you from logging in.

- Chrome: Settings → Privacy and Security → Cookies
- Safari: Settings → Privacy → Block All Cookies
- Firefox: Options → Privacy & Security → Cookies and Site Data
- Edge: Settings → Cookies and Site Permissions

### In the app or website

A cookie consent banner appears on your first visit to swingby.ca. You can:
- Accept all cookies
- Accept only strictly necessary cookies
- Manage individual categories

You can change your preferences at any time by visiting the cookie settings link in the website footer.

### Opt-out of analytics

- **PostHog:** visit posthog.com/privacy or contact us at privacy@swingby.ca
- **Plausible:** visit plausible.io/data-policy (Plausible does not use cookies by default)

---

## Do Not Track

Some browsers send a "Do Not Track" signal. SwingBy does not currently respond to Do Not Track signals because there is no industry standard for what platforms are required to do. We provide opt-out controls above as an alternative.

---

## Changes to this policy

We may update this policy when we add or remove analytics tools or change how we use cookies. The "Last updated" date at the top of this page reflects when changes were made. Material changes will be notified via the in-app cookie consent banner.

---

## Contact

For questions about our cookie practices:  
**Email:** privacy@swingby.ca
