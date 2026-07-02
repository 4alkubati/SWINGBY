# credentials/ — Local-only secrets vault

> **Everything in this folder is gitignored except this README.**
> If you can read a credential, the file is on your machine only — never committed.

## Why this folder exists
One predictable place to find every secret you might need while working on SwingBy:
test accounts you sign in with, third-party API keys, webhook secrets, service
credentials. Stop hunting through `.env` files, password managers, and old chat
logs — drop it here.

## Layout

```
credentials/
├── README.md              ← this file (the only committed file in here)
├── test-accounts/         ← seed users for signing into the app
│   └── seed-accounts.md   ← client / business_owner / employee logins
└── api-keys/              ← third-party service keys + connection notes
    └── (your files)       ← e.g. resend.md, supabase.md, google-maps.md
```

## How to use

- **New secret?** Drop a markdown file in the right subfolder. Use kebab-case
  names like `stripe-sandbox.md`, `expo-push.md`, `cloudflare-pages.md`.
- **Need a secret?** Look here first — should be the only place you check.
- **Rotating a secret?** Update the file here, then update the live
  environment (Render, Supabase, EAS, etc.). Both must change.

## What does NOT belong here

- `.env` files used by the apps (`backend/.env`, `mobile/.env`,
  `web/launch/.env`) — those stay next to their app so the framework can read
  them. Mirror the values here as plain markdown if you want a single index.
- Live agent secrets that the Claude Code orchestrator reads at runtime —
  those live in `.claude/secrets/` (already gitignored, has its own
  template-vs-filled convention).
- Anything that needs to be in version control — by definition that's not a
  secret.

## Reminder
The `.gitignore` rule is `credentials/*` + `!credentials/README.md`. If you
ever rename this README, update `.gitignore` or you'll leak secrets on the
next `git add .`.
