---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy Admin Console

Dark-themed admin dashboard for the SwingBy platform. Built with React 18 + Vite 5.

## Quick Start

```bash
cd web/admin

# 1. Install dependencies
npm install

# 2. Copy env and set your API URL
cp .env.example .env

# 3. Run on port 5174
npm run dev
```

Open http://localhost:5174 in your browser.

## Environment Variables

| Variable       | Default                               | Description          |
|----------------|---------------------------------------|----------------------|
| VITE_API_URL   | https://swingbyy-api.onrender.com     | Backend API base URL |

## Routes

| Path          | Page             | Notes                                   |
|---------------|------------------|-----------------------------------------|
| /login        | LoginPage        | Email + password → POST /auth/login     |
| /             | DashboardPage    | 4 KPI cards + activity feed             |
| /users        | UsersPage        | User table with suspend toggle          |
| /businesses   | BusinessesPage   | Business table with license status      |
| /bookings     | BookingsPage     | Booking table with status + amount      |
| /audit-log    | AuditLogPage     | Admin action log (placeholder if 404)   |

## Login Flow

1. POST /auth/login with `{ email, password }`
2. Token stored in localStorage as `swingby_admin_token`
3. GET /auth/me called automatically
4. If `user.role !== 'admin'` → session cleared + "Admin access required" shown
5. ProtectedRoute guards all admin pages

## Build for Production

```bash
npm run build
# Output: dist/
```

## Stack

- React 18
- Vite 5 (port 5174)
- react-router-dom v6
- axios (all API calls via src/services/api.js)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
