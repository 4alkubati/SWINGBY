---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# Security Deployment Playbook

## Cloudflare Setup

### 1. DNS & Proxy
- Route all traffic through Cloudflare (orange cloud enabled).
- Set SSL/TLS to **Full (strict)** — requires a valid origin cert.
- Enable **Always Use HTTPS**.
- Enable **HSTS** (max-age: 31536000, include subdomains, preload).

### 2. WAF Rules (Business/Enterprise)
```
# Block common scanners
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") → Block

# Rate limit auth endpoints
/auth/login → 10 req/min per IP → Block
/auth/signup → 5 req/min per IP → Block
```

### 3. DDoS Mitigation
- Enable **DDoS Protection** (L7) — Cloudflare managed rules.
- Set **Security Level: Medium** in production.
- Enable **Bot Fight Mode**.
- Under attack? Enable **I'm Under Attack Mode** (adds JS challenge).

### 4. Page Rules / Cache Rules
```
/app/* → Cache Level: Bypass
/auth/* → Cache Level: Bypass
/api/* → Cache Level: Bypass
/* → Cache Level: Standard, Edge Cache TTL: 4 hours
```

### 5. Origin IP Protection
- Never expose origin IP in DNS.
- Add Cloudflare IP ranges to origin firewall allowlist only.
- Reference: https://www.cloudflare.com/ips/

---

## Backend Hardening

### Request Size Limit
Add to `backend/app/main.py` if not present:
```python
from starlette.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.swingbyapp.ca", "localhost"])
```

### CORS
Verify `backend/app/main.py` CORS origins include only:
```python
allow_origins=["https://swingbyapp.ca", "https://www.swingbyapp.ca"]
```
Remove `http://localhost:*` from production config.

### Rate Limiting (slowapi — already implemented)
Current limits in `backend/app/main.py`:
- Default: 100/minute per IP
- Auth endpoints: 10/minute per IP (in-memory brute-force lockout in auth.py)

For production, switch to Redis-backed rate limiting:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
```

---

## Dependency Security

```bash
# Run in CI
npm audit --audit-level=moderate       # web/launch/
pip-audit -r requirements.txt          # backend/

# Automate with GitHub Actions (see .github/workflows/web-launch-ci.yml)
```

---

## Secret Scanning

Never commit:
- `SUPABASE_SERVICE_KEY` — backend only, in `.env`
- `SECRET_KEY` — JWT signing, backend only
- `VITE_SUPABASE_ANON_KEY` — client-safe (anon key), but still keep out of logs

Pre-commit check:
```bash
grep -rE "(SUPABASE_SERVICE_KEY|eyJhbGci|sk_live_|sk_test_)" web/launch/ backend/app/
```

---

## Sentry PII Stripping

`web/launch/src/lib/sentry.js` strips `event.user.email` and `event.user.ip_address` in `beforeSend`.
Verify DSN is set only via `VITE_SENTRY_DSN` (never hardcoded).

---

## Incident Response

### Suspected breach
1. Rotate `SUPABASE_SERVICE_KEY` and `SECRET_KEY` immediately.
2. Force-expire all sessions: Supabase dashboard → Auth → Users → "Sign out all users."
3. Enable Cloudflare "Under Attack Mode."
4. Review Supabase Logs (MCP: `get_logs`) for unusual query patterns.
5. Notify affected users within 72 hours (PIPEDA requirement).

### Brute-force detected
- In-memory lockout (5 attempts/min) already active in `backend/app/api/auth.py`.
- Cloudflare WAF rule for `/auth/login` provides IP-level blocking.
- Consider hCaptcha integration (`VITE_HCAPTCHA_SITEKEY` env var already plumbed in).

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
