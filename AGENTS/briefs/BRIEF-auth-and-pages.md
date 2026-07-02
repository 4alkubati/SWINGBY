# Agent brief — Auth correctness + page completeness (pre-launch web + mobile)

> Run via the AGENTS orchestrator. Follow claude/config/DISPATCH_GATE.md (all 7 layers). Verify each task before done. Update memory. Never touch secrets. Payment stays sandbox.
> Goal: make signup/login honest, complete, and professional — no false claims, no dead pages, no placeholder copy.

## 1. Email-verification honesty (CRITICAL)
- Bug: dashboard shows "Email verified ✓" even though the user never verified — signup drops straight into the dashboard and the "Profile completeness" checklist hardcodes that line.
- Fix (code): dashboard must read the REAL auth state (`email_confirmed_at` / session user), not hardcode. If not confirmed → show "Confirm your email", not a green check.
- Fix (flow): after signup show a "Check your email to confirm" screen; don't drop the user into the dashboard until confirmed (once confirm-email is ON — Kira item below).
- Apply the same honesty to every completeness item.

## 2. DB cascade migration (fixes "Database error saving new user")
- public.users.id FK → auth.users(id) lacks ON DELETE CASCADE → deleting an auth user orphans the profile and breaks re-signup.
- Apply via Supabase MCP apply_migration:
  alter table public.users drop constraint if exists users_id_fkey,
    add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
- Verify: deleting an auth user removes its public.users row.

## 3. Auth redirect correctness
- Confirm/magic links redirect to localhost:3000 (dead). Code side: build redirect from production origin (https://swingbyy.com), not hardcoded localhost. Audit emailRedirectTo / redirect params in web auth calls.

## 4. Forgot-password — full flow (web pre-launch + mobile)
- request reset → email → reset page → new password → login. No dead links, no stubs, both platforms.

## 5. Page-completeness audit (professional, not limited)
- Enumerate every route/screen (web pre-launch + mobile). Each must exist, render, and have real professional copy. No 404s, no placeholder/"coming soon"/beginner wording. List gaps + fix.

## Kira-only (dashboard/DNS — agent cannot do, just flag):
- Supabase → Auth → turn ON "Confirm email."
- Supabase → Auth → URL Configuration → Site URL = https://swingbyy.com + redirect URLs https://swingbyy.com/**, swingby://**.
- Add DMARC DNS record (spam fix).
