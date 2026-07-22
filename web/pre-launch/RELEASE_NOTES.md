---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy Launch Website — Release Notes

**Build date:** 2026-06-03  
**Status:** Ready for user review and manual deploy  
**Target:** Cloudflare Pages (swingbyy.com)  
**Deploy gate:** User manually deploys when mobile app is ready

---

## Routes Shipped (53 pages)

### Marketing (15 routes)
| Route | Page | Reference |
|---|---|---|
| `/` | Home | Vercel + Lyft |
| `/how-it-works` | How It Works | Stripe |
| `/for-clients` | For Clients | Hims |
| `/for-businesses` | For Businesses | Stripe |
| `/pricing` | Pricing | Linear |
| `/categories` | Categories Index | Thumbtack |
| `/categories/:slug` | Category Page (7) | Thumbtack |
| `/cities` | Cities Index | Lyft |
| `/cities/calgary` | Calgary | Lyft |
| `/safety` | Safety | Linear |
| `/about` | About | Notion |
| `/press` | Press / Newsroom | Linear |
| `/careers` | Careers | Notion |
| `/contact` | Contact | Linear |
| `/download` | Download App | Apple |

### Help & Blog (4 routes)
| Route | Page |
|---|---|
| `/help` | Help Center |
| `/help/:slug` | Help Article (12 articles) |
| `/blog` | Blog Index |
| `/blog/:slug` | Blog Post (6 posts) |

### Auth (6 routes)
| Route | Page |
|---|---|
| `/login` | Login (email/password + magic link) |
| `/signup` | Signup (role picker) |
| `/auth/callback` | Auth Callback |
| `/forgot-password` | Forgot Password |
| `/reset-password` | Reset Password |
| `/verify-email` | Verify Email |

### Onboarding (2 routes)
| Route | Page |
|---|---|
| `/onboarding/client` | Client Onboarding (4 steps) |
| `/onboarding/business/*` | Business Onboarding (7 steps) |

### Client Dashboard (13 routes, auth-protected)
| Route | Page |
|---|---|
| `/dashboard` | Client Dashboard |
| `/bookings` | Bookings List |
| `/bookings/:id` | Booking Detail |
| `/messages` | Messages |
| `/messages/:bookingId` | Message Thread |
| `/profile` | Profile |
| `/reviews` | Reviews |
| `/favorites` | Favorites |
| `/searches` | Saved Searches |
| `/payment-methods` | Payment Methods |
| `/account` | Account Settings |
| `/notifications` | Notification Settings |
| `/privacy-settings` | Privacy Settings |

### Business Dashboard (5 routes, role-protected)
| Route | Page |
|---|---|
| `/business/dashboard` | Business Dashboard |
| `/business/earnings` | Earnings |
| `/business/employees` | Team Members |
| `/business/services` | Services |
| `/business/profile` | Business Profile |

### Legal (4 routes)
| Route | Page |
|---|---|
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/cookies` | Cookie Policy |
| `/accessibility` | Accessibility Statement |

### Utility (3 routes)
| Route | Page |
|---|---|
| `/maintenance` | Maintenance Mode |
| `/500` | Server Error |
| `*` | 404 Not Found |

---

## Component Library (33 components)

Button, Card, Input, Select, Checkbox/Radio, Textarea, Badge, Avatar, Modal, Tabs, Accordion, Tooltip, Breadcrumbs, Pagination, StatsBlock, FAQItem, SEO, Layout, Header, MobileNav, Footer, ErrorBoundary, PageSkeleton, ProtectedRoute, RoleProtectedRoute, DashboardLayout, OfflineBanner, PageTransition, CookieBanner, HeroLottie, TextField, Dialog, DropdownMenu

---

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Routing:** react-router-dom v7 (v6 API compat)
- **Styling:** CSS Modules + CSS custom properties (locked palette)
- **Animation:** framer-motion 11
- **Icons:** @phosphor-icons/react
- **Fonts:** @fontsource/space-grotesk + @fontsource/inter (self-hosted)
- **Auth:** Supabase Auth
- **SEO:** react-helmet-async + JSON-LD
- **i18n:** i18next (English, fr-CA structure ready)
- **Analytics:** Plausible + GA4 placeholder
- **Error tracking:** Sentry (env-gated)
- **Markdown:** react-markdown + remark-gfm

---

## Build Output

- **161 source files** across pages, components, data, hooks, and config
- **Code splitting:** 6 vendor chunks (react, motion, i18n, supabase, markdown, app)
- **All route chunks < 100KB gzipped**
- **Largest vendor chunk:** vendor-supabase at 54KB gzipped
- **Zero build errors, zero warnings**

---

## Deliverables

- [x] All 53 page routes implemented with lazy loading
- [x] Auth flow: signup, login, magic link, password reset, email verification
- [x] Protected routes (auth-gated + role-gated)
- [x] Client onboarding (4-step wizard)
- [x] Business onboarding (7-step wizard)
- [x] Dashboard layouts for clients and businesses
- [x] CSS variables only — no inline hex codes
- [x] i18n: all strings through `t()` function
- [x] Loading skeletons on every route
- [x] Empty states on all dashboard pages
- [x] framer-motion entrance animations
- [x] Offline detection banner
- [x] Print stylesheet
- [x] Reduced motion support
- [x] robots.txt + sitemap.xml
- [x] Cloudflare security headers (CSP, X-Frame-Options, etc.)
- [x] Branded email templates (confirm, reset, magic link)
- [x] Sentry error tracking (env-gated DSN)

---

## Manual Steps Required

1. **Deploy to Cloudflare Pages** when mobile app is ready
2. **Paste email templates** into Supabase dashboard (Auth > Email Templates)
3. **Set environment variables** in Cloudflare: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_API_URL`
4. **Add OG image** at `public/og-image.png` (1200x630)
5. **Verify Plausible** domain is configured for swingbyy.com

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
