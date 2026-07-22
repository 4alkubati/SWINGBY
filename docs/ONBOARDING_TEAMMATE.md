---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# Onboarding a New Teammate

Checklist for granting a new person access to SwingBy infrastructure, with minimum-privilege approach.

---

## 1. GitHub

1. Go to [github.com/4alkubati/SWINGBY/settings/collaborators](https://github.com/4alkubati/SWINGBY/settings/collaborators)
2. Add the teammate's GitHub username.
3. Role:
   - **Write** — for engineers who need to push branches and open PRs
   - **Read** — for non-engineers who need to view the codebase only
4. Do NOT grant Owner or Admin unless absolutely necessary.

---

## 2. Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → Project `SWINGBY` → Settings → Team.
2. Invite the teammate by email.
3. Role:
   - **Developer** — can view tables, run queries, view logs. Cannot modify auth settings or billing.
   - **Owner** — full access. Reserve for founders only.
4. If the teammate only needs database read access for analytics, use a Supabase service role key scoped to read-only tables, delivered via a secure channel. Do not share the main service role key.

**What to share:** Supabase project URL and anon key only (these are publishable).
**What NOT to share:** `SUPABASE_SERVICE_KEY` — this bypasses RLS and has full DB access. It lives in `backend/.env` only.

---

## 3. Render (backend hosting)

1. Go to [dashboard.render.com](https://dashboard.render.com) → `swingby-api` service → Settings → Team.
2. Invite the teammate by email.
3. Role:
   - **Member** — can view deployments and logs, cannot change env vars or billing.
   - **Admin** — can change env vars. Reserve for engineers with prod access.

---

## 4. Cloudflare Pages (frontend hosting)

1. Go to Cloudflare dashboard → Manage Account → Members.
2. Invite the teammate by email.
3. Role:
   - **Cloudflare Workers: Edit** — for frontend engineers.
   - **Administrator** — only for the account owner.

---

## 5. Sentry (error monitoring)

1. Go to sentry.io → Settings → Members → Invite Member.
2. Role:
   - **Member** — can view error events. Good for all engineers.
   - **Manager** — can change alerts and integrations. Reserve for senior engineers.

---

## 6. What to send the new teammate

A secure message (use 1Password, Signal, or a secrets manager) containing:

```
GitHub: invite sent to [their email]
Supabase: invite sent
Backend dev .env: [paste the non-production .env values — not the prod service key]
SUPABASE_SERVICE_KEY: [send separately only if they need backend access]
```

**Never send credentials in Slack, email, or any unencrypted channel.**

---

## 7. Minimum privilege checklist

Before granting access, confirm:

- [ ] What does this person actually need to do?
- [ ] Can they do it with read-only access?
- [ ] Have I avoided sharing the `SUPABASE_SERVICE_KEY` unless it's strictly necessary?
- [ ] Is this person expected to access production data? If not, point them to staging.
- [ ] Has the teammate signed an NDA or employment agreement covering data handling?

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
