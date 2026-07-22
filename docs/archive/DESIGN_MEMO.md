---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Design Memo
> Single source of truth for the app's visual direction, UX decisions, and screen-by-screen specifications.
> Every agent building this app must read this file before writing a single line of UI code.
> Do not deviate from these decisions without explicit user approval.

---

## 1. What SwingBy Is

Dual-sided service marketplace. Two users, two experiences, one app.

- **Ali** = Client. Needs a service. Posts a job or browses nearby.
- **Ahmed** = Business owner. Offers services. Bids on jobs or gets discovered.
- **Khalid** = Ahmed's employee. Does the actual work. Has his own profile under Ahmed's company.

The app connects them cleanly, protects both sides, and gets out of the way.

---

## 2. Design Direction

**The vibe:** Dark, premium, futuristic. Not corporate. Not cheap. Think Uber Black meets a high-end fintech app.

**Reference:** The SwingBy pre-launch site at `web/pre-launch/` — match that aesthetic exactly but elevated.

**Key feel:** Every screen should feel like it belongs on a flagship phone. Dense with info but never cluttered. Fast, confident, zero fluff.

---

## 3. Design Tokens — Use These Exactly

```
BACKGROUNDS
--bg-primary:    #07080a   ← main screen background
--bg-card:       #0d0f10   ← cards, inputs, nav
--bg-card2:      #0f1214   ← featured cards, elevated surfaces
--bg-subtle:     #131618   ← tags, pills, inner elements

BORDERS
--border-soft:   #1a1d1f   ← default card borders
--border-mid:    #2a2e33   ← inputs, stronger separation

TEXT
--text-primary:  #ffffff   ← headings, names, key info
--text-body:     #f0ede8   ← body text
--text-secondary:#9ca3af   ← labels, meta info
--text-muted:    #6b7280   ← hints, placeholders
--text-ghost:    #3a424c   ← very muted, disabled states

ACCENT
--orange:        #FF5C00   ← primary accent, CTAs, active states
--orange-light:  #FF8C42   ← secondary orange, hover states
--orange-glow:   rgba(255,92,0,0.35) ← button shadows
--orange-bg:     rgba(255,92,0,0.10) ← tinted backgrounds
--orange-border: rgba(255,92,0,0.25) ← tinted borders

SEMANTIC
--green:         #4ade80   ← verified badges, success, lawn category
--green-bg:      rgba(34,197,94,0.08)
--green-border:  rgba(34,197,94,0.25)
--blue:          #60a5fa   ← plumbing, water-related categories
--blue-bg:       rgba(59,130,246,0.10)

GRADIENTS (avatars and CTAs only)
--grad-orange:   linear-gradient(135deg, #FF5C00, #FF3D00)
--grad-green-av: linear-gradient(135deg, #1a3a2a, #0f2a1a)
--grad-blue-av:  linear-gradient(135deg, #1a2a3a, #0f1a2a)
--grad-card:     linear-gradient(135deg, #0f1214, #131618)
```

---

## 4. Typography

```
HEADINGS:   Space Grotesk, weight 700, letter-spacing -0.5px to -1px
BODY:       Inter, weight 400/500/600
LABELS:     Inter, weight 700, uppercase, letter-spacing 0.8-1.2px, font-size 11px
```

Install via `expo-font` or `@expo-google-fonts/space-grotesk` + `@expo-google-fonts/inter`.

---

## 5. Visual Rules

- Glow orbs on hero screens only — radial orange gradient, subtle, top-right and bottom-left
- Cards use `border-radius: 18-20px` for main cards, `12-14px` for inner elements
- Active/selected state = orange border + orange-tinted background
- Verified badge = green, always shows shield-check icon
- Avatars = colored gradient backgrounds with 2-letter initials, `border-radius: 14-16px`
- Top Rated featured card gets an orange glow effect in the corner
- CTA buttons = `--grad-orange` with `box-shadow: 0 6px 20px --orange-glow`
- Distance always shown as pill with map-pin icon in orange
- No white backgrounds anywhere — this is a dark app throughout

---

## 6. Navigation Structure

```
App
├── Auth Stack (not logged in)
│   ├── SplashScreen
│   ├── OnboardingScreen
│   ├── LoginScreen
│   └── SignupScreen (Client or Business)
│
├── Client Tab Navigator (Ali's app)
│   ├── HomeScreen          ← Browse + Post a Job
│   ├── MyJobsScreen        ← active + past jobs
│   ├── MessagesScreen      ← all booking chats
│   └── ProfileScreen       ← Ali's profile + settings
│
└── Business Tab Navigator (Ahmed's app)
    ├── DashboardScreen     ← active bookings + new opportunities
    ├── JobsScreen          ← job history
    ├── MessagesScreen      ← all booking chats
    └── BusinessProfileScreen ← company profile + team management
```

Role is set at signup. Client and Business see completely different tab navigators.

---

## 7. Client Screens — Ali's Side

### 7.1 HomeScreen

**Mode switcher** at top — two tabs like Uber:
- `Browse` tab (left) — discover nearby businesses
- `Post a Job` tab (right) — submit a job request

Active tab = orange gradient button. Inactive = dark bg, muted text.

**Browse Mode:**
- Search bar (dark bg, mid border, search icon left, filter icon right)
- Category horizontal scroll — Cleaning, Plumbing, Moving, Electrical, Lawn, Painting, Carpentry, + more
  - Each category: icon + label, dark card, active = orange border + orange-tinted bg
- "Top Rated" section — one FeaturedCard (see component spec below)
- "Nearby" section — list of NearbyCards (see component spec below)
- "Map view" link on Nearby header → opens MapScreen

**Post a Job Mode:**
- Description textarea — "What do you need?"
- Budget input + Category selector (side by side row)
- Date picker + Time picker (side by side row)
- Photo upload box — dashed orange border, camera icon, label "Upload a photo", sub-label "Businesses see this before quoting"
- Orange CTA button — "Post job →"

**Bottom Nav:** Home · My Jobs · Messages · Profile
- Active tab = orange icon + orange label + small orange dot below
- Inactive = very dark icon color `#2a2e33`

---

### 7.2 QuoteComparisonScreen

Ali posted a job. Multiple businesses quoted. This screen shows when Ali taps "View Quotes."

**Header:** "X businesses quoted" + job title

**Comparison table — up to 3 businesses side by side:**
Each column shows:
- Business avatar (gradient initials)
- Business name
- Star rating
- Jobs completed
- Distance
- Quoted price (large, prominent)
- "Select" button (orange for recommended/lowest, dark for others)

Businesses sorted by rating × price score by default.

Tapping a business name → BusinessProfileScreen (read-only view).
Tapping "Select" → confirmation sheet → booking created → chat opens.

---

### 7.3 ActiveBookingScreen

After Ali accepts a quote. Shows:

**Top section — who's coming:**
- Worker's photo (circular, large)
- Worker's name + role title
- Star rating + jobs completed
- Company name (Ahmed's Cleaning Co.)
- Status pill: "On the way" / "Started" / "Done"

This is the Uber driver card moment. Ali sees the exact person coming, not just the company name.

**Middle section — job details:**
- Service type
- Date + time confirmed
- Address
- Quoted price

**Bottom section — chat button:**
Only visible after booking is confirmed. Opens MessagesScreen filtered to this booking.

---

### 7.4 BusinessProfileScreen (read-only for clients)

Ali taps a business from Browse or Quotes.

**Top — Identity:**
- Large company logo/avatar
- Business name (Space Grotesk, 22px, bold)
- Verified badge (green, shield icon)
- Star rating (large) + total jobs completed
- Category tags
- "Book directly" CTA (orange) — only in Browse flow

**Middle — Team (Fineline model):**
- "Select a team member" header
- Grid of employee cards (2 columns):
  - Employee photo (circular)
  - Name
  - Star rating specific to them
  - "Any provider" option first in the grid
- Tapping an employee → EmployeeProfileScreen

**Bottom — Reviews:**
- Scrollable review list
- Each review: client first name, star rating, job type, comment, date

---

### 7.5 EmployeeProfileScreen

Ali taps Khalid's card.

- Large circular photo
- Name + role title (e.g. "Senior Cleaner")
- Under: "Ahmed's Cleaning Co." with small company logo — tappable → BusinessProfileScreen
- Stats row: ★ rating | X jobs | X reviews
- Verified badge if applicable
- Work photo gallery (grid of photos from completed jobs)
- Scrollable reviews specific to Khalid

---

## 8. Business Screens — Ahmed's Side

### 8.1 DashboardScreen

Split into two sections:

**Active Bookings (top):**
- Horizontal scroll of booking cards
- Each card: client name, service type, date/time, assigned employee, status pill
- Status pills: Confirmed (blue) / On the way (orange) / In Progress (orange) / Done (green)

**New Opportunities (bottom):**
- Vertical list of open job posts from clients
- Each job card shows:
  - Client first name + avatar
  - Job description (truncated to 2 lines)
  - Budget
  - Date + time (set by client — Ahmed sees this upfront)
  - Distance from business
  - Photo thumbnail (client's uploaded photo of the space)
  - "Send Quote" button — ONE TAP, opens price input sheet, submit = done

---

### 8.2 SendQuoteSheet

Bottom sheet that appears when Ahmed taps "Send Quote."

- Job summary (title, date, photo)
- Single price input field — large, prominent
- "Send quote →" orange button
- No message, no essay. Price only.

---

### 8.3 JobManagementScreen

Ahmed or Khalid opens an active booking.

**Header:** Job title + client name + address

**Status bar (tap to advance):**
```
[ On my way ] → [ Started ] → [ Done ]
```
Large, clear, one tap per stage. Current stage highlighted in orange.

**Photo proof section:**
- "Upload proof of work" — appears when status = Done
- Camera icon, dashed border
- Can upload multiple photos
- Required before marking complete

**Client info:**
- Name, address, booked date/time

**Employee assigned:**
- Who is doing this job (if company has employees)

---

### 8.4 BusinessProfileScreen (owner edit mode)

Same as client read-only view but editable.

**Editable fields:**
- Business name
- Category
- Service radius
- Description
- Profile photo / logo
- License status (view only — SwingBy verifies manually)

**Team management section:**
- List of all employees
- Each row: photo, name, role title, active/inactive toggle, "Edit" link
- "Invite employee" button → sends link → they join → profile auto-generated

---

### 8.5 EmployeeManagementScreen

Ahmed taps "Edit" on an employee.

- Photo (employee-set, Ahmed can override)
- Name (from account)
- Role title (Ahmed sets this — "Senior Cleaner", "Technician", etc.)
- Active / Inactive toggle
- View their stats: rating, jobs completed, reviews

---

## 9. Shared Screens

### 9.1 MessagesScreen

- List of all booking chats
- Each row: other party's name + avatar, booking job type, last message preview, timestamp
- Tapping → ChatScreen

### 9.2 ChatScreen

- Dark background
- Messages in bubbles: sent = orange bubble right, received = dark card left
- Input bar at bottom
- Header shows: other party's name + booking status pill
- NO chat before booking is confirmed — this screen only exists for confirmed bookings

### 9.3 ReviewScreen

After job is marked complete, Ali is prompted to review.

- Worker's photo + name
- Star selector (1–5 stars, large tap targets)
- Optional comment field
- "Submit review" orange button
- Review goes on Khalid's profile + Ahmed's company profile

---

## 10. Key UX Rules — Do Not Break These

1. **Ali sets the date/time when posting** — not after accepting a quote. Businesses quote knowing the schedule.
2. **Chat only opens after booking is confirmed** — zero pre-booking contact.
3. **Businesses see Ali's photo before quoting** — full transparency, no surprises on the day.
4. **Quick bid only** — price, one tap. No essays, no lengthy proposals.
5. **Employee profiles live under the company** — Khalid can't operate independently. His reviews, stats, and bookings all tie to Ahmed's company.
6. **"Any service provider" option always first** in team selection grid.
7. **Payment is automatic** — releases on job completion, no manual action from either party.
8. **Job proof photo required** before marking Done — protects both sides.
9. **Reviews are on the worker, not just the company** — Ali reviews Khalid specifically.
10. **No map in Post a Job flow** — map is Browse only.

---

## 11. Component Specs

### ModeSwitch
```
Props: mode ('browse' | 'post'), onSwitch(mode)
Container: dark bg #0d0f10, border #1a1d1f, border-radius 14, padding 4
Active button: --grad-orange, white text, shadow --orange-glow
Inactive button: transparent bg, color #666
Icons: compass for Browse, plus for Post a Job
```

### CategoryScroll
```
Props: categories[], selected, onSelect(category)
Layout: horizontal FlatList, no scroll indicator
Each item: dark card, icon (24px) + label (11px bold)
Active: --orange-bg bg, --orange-border border, orange label
Categories with icons:
  Cleaning   → sparkles icon
  Plumbing   → tool icon
  Moving     → truck icon
  Electrical → bolt icon
  Lawn       → plant icon
  Painting   → paint icon
  Carpentry  → hammer icon
```

### FeaturedCard
```
Props: business { name, initials, rating, jobCount, distance, tags, verified }
Container: --grad-card bg, border #1e2226, border-radius 20, padding 14
Glow: radial orange glow top-right corner (absolute positioned)
Badge: "TOP RATED" pill, top-right, --orange-bg, orange text
Avatar: 54x54, --grad-orange, border-radius 16, orange shadow
Name: Space Grotesk 15px bold, white
Meta: 12px, --text-secondary, star in orange
Tags: small pills, dark bg, 10px bold
Verified tag: --green-bg, --green-border, green text, shield icon
```

### NearbyCard
```
Props: business { name, initials, rating, jobCount, distance, avatarColor }
Container: --bg-card, border --border-soft, border-radius 18, padding 13
Avatar: 46x46, gradient based on avatarColor prop, border-radius 14
Name: 14px semibold, white
Meta: 12px, --text-secondary, star orange
Distance pill: --bg-subtle, --border-mid, map-pin icon orange, 11px
```

### BottomNav
```
Props: state, descriptors, navigation (from React Navigation tabBar prop)
Active tab: orange icon + orange label + 4px orange dot below
Inactive tab: icon color #2a2e33, label color #3a424c
Border top: 1px solid #111315
Icons: home, file-text, message, user (use @expo/vector-icons Feather or Ionicons)
```

### FeaturedCard — Job Post (Ahmed's opportunity feed)
```
Props: post { clientName, clientAvatar, description, budget, date, time, distance, photoUrl }
Container: --bg-card2, border --border-soft, border-radius 18
Photo thumbnail: right side, 64x64, border-radius 12
Client: avatar circle + first name
Description: 2 lines max, --text-body
Budget: large, orange, bold
Date + time: calendar icon + clock icon, --text-secondary
"Send Quote" button: full width, --grad-orange, border-radius 12
```

---

## 12. Screens Left to Build (in order)

| Screen | Priority | Notes |
|---|---|---|
| OnboardingScreen | HIGH | Role selection: Client or Business |
| LoginScreen | HIGH | Email + password, Supabase auth |
| SignupScreen | HIGH | Different forms per role |
| QuoteComparisonScreen | HIGH | Side-by-side, up to 3 businesses |
| ActiveBookingScreen | HIGH | Uber-style worker card |
| BusinessProfileScreen (client view) | HIGH | With team grid |
| EmployeeProfileScreen | HIGH | Portfolio + reviews |
| DashboardScreen (business) | HIGH | Two sections: bookings + opportunities |
| SendQuoteSheet | HIGH | Bottom sheet, price only |
| JobManagementScreen | HIGH | Status taps + photo proof |
| ChatScreen | MEDIUM | Post-booking only |
| MessagesScreen | MEDIUM | List of booking chats |
| ReviewScreen | MEDIUM | Post-completion rating |
| MapScreen | MEDIUM | Browse nearby on map |
| BusinessProfileScreen (edit mode) | MEDIUM | Owner editing their profile |
| EmployeeManagementScreen | MEDIUM | Ahmed manages his team |
| MyJobsScreen (client) | MEDIUM | Active + past jobs |
| ProfileScreen (client) | LOW | Ali's settings |
| NotificationsScreen | LOW | Quotes received, booking updates |

---

## 13. API Integration

Backend is FastAPI running at `EXPO_PUBLIC_API_URL` env variable.
All routes require `Authorization: Bearer <token>` except `/auth/signup` and `/auth/login`.

Key endpoints the mobile app uses:
```
POST  /auth/signup          → create account
POST  /auth/login           → get JWT token
GET   /auth/me              → current user
GET   /businesses/nearby    → Browse map/list (lat, lng, radius_km)
GET   /service-posts/       → Ahmed sees open job posts
POST  /service-posts/       → Ali creates a post
POST  /interests/           → Ahmed sends a quote (quoted_price only)
GET   /interests/post/{id}  → Ali sees all quotes on his post
PATCH /interests/{id}/accept → Ali accepts a quote → booking created
GET   /bookings/            → list bookings for current user
PATCH /bookings/{id}/assign-employee → Ahmed assigns Khalid
PATCH /bookings/{id}/complete → mark job done
POST  /messages/            → send chat message
GET   /messages/{booking_id}→ get chat history
POST  /reviews/             → submit review
```

Token stored in `expo-secure-store`. Attach to every request via axios interceptor.

---

## 14. State Management

Use React Context for now (post-MVP → Zustand or Redux Toolkit):

```
AuthContext    → user, token, role, login(), logout()
BookingContext → active bookings, refresh()
```

---

## 15. File Structure

```
mobile/
├── App.js                    ← navigation root, tab navigators per role
├── index.js                  ← registerRootComponent(App)
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── PostJobScreen.js
│   │   ├── QuoteComparisonScreen.js
│   │   ├── ActiveBookingScreen.js
│   │   ├── BusinessProfileScreen.js
│   │   ├── EmployeeProfileScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── JobManagementScreen.js
│   │   ├── ChatScreen.js
│   │   ├── MessagesScreen.js
│   │   ├── ReviewScreen.js
│   │   ├── LoginScreen.js
│   │   ├── SignupScreen.js
│   │   └── OnboardingScreen.js
│   ├── components/
│   │   ├── ModeSwitch.js
│   │   ├── CategoryScroll.js
│   │   ├── FeaturedCard.js
│   │   ├── NearbyCard.js
│   │   ├── BottomNav.js
│   │   ├── JobCard.js
│   │   ├── QuoteCard.js
│   │   ├── WorkerTrustCard.js
│   │   ├── SendQuoteSheet.js
│   │   ├── StatusTracker.js
│   │   └── ReviewModal.js
│   ├── navigation/
│   │   ├── ClientNavigator.js
│   │   ├── BusinessNavigator.js
│   │   └── AuthNavigator.js
│   ├── services/
│   │   ├── api.js            ← axios instance + interceptors
│   │   ├── auth.js           ← login, signup, token storage
│   │   └── location.js       ← expo-location wrapper
│   └── context/
│       ├── AuthContext.js
│       └── BookingContext.js
└── design/
    └── home-screen-ali.html  ← visual reference wireframe
```

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
