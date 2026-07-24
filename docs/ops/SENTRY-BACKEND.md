# Backend error monitoring (Sentry) — status & wiring

Last verified: **2026-07-23**.

## What is actually true (measured, not assumed)

- **SDK installed:** yes — `sentry-sdk[fastapi]>=2.0` in `backend/requirements.txt`
  (resolves to 2.66.x).
- **Initialised in code:** yes — `backend/app/main.py` calls `sentry_sdk.init(...)`
  with `FastApiIntegration()`, a `traces_sample_rate`, a `before_send` filter that
  drops `httpx.RemoteProtocolError` noise, and (as of this change)
  `include_local_variables=False` + `send_default_pii=False` to honour
  `docs/legal/PRIVACY_POLICY.md`. **The init is guarded by `if settings.SENTRY_DSN:`
  — it is a complete no-op when the DSN is empty.**
- **DSN on Render:** **unset / unproven.** `SENTRY_DSN` is declared optional in
  `backend/app/config.py`; it is not in `backend/render.yaml`'s `envVars`, and there
  are no Render dashboard credentials on this box to inspect the live env. Because
  the init no-ops silently without a DSN, backend errors are almost certainly
  **not being captured** in production today.

## A Sentry org already exists (proven live)

`mobile/.env.production` (committed) contains a real client DSN:
`https://…@o4511470867382272.ingest.us.sentry.io/4511470881210368`.
The ingest endpoint for that org/project was probed on 2026-07-23 and returned
HTTP 200 with an accepted `event_id`; a bogus key on the same project returned
HTTP 403. So the **Sentry org `o4511470867382272` is live and ingesting** — this
is the mobile project's DSN. The **backend just needs its own DSN wired.**

## Cost

Sentry **Developer (free) plan**: 1 user, 5k errors/month, 30-day retention —
ample for pre-beta. No paid plan required.

## What Kira must do (5 minutes, his hands)

1. sentry.io → same org (`swingby`, id `o4511470867382272`) → **Create Project**
   → platform **Python / FastAPI** → name it `swingby-backend`. Copy its DSN
   (looks like `https://<key>@o4511470867382272.ingest.us.sentry.io/<projectid>`).
2. Render → service **swingbyy-api** → **Environment** → add
   **`SENTRY_DSN`** = *(paste the DSN from step 1)*. Save → let it redeploy.
   (Optional: also set `ENV=production` so events are tagged `production` not
   `development`.)
3. Verify end-to-end with the committed probe (admin-gated, safe, no side effects):
   ```
   curl -H "Authorization: Bearer <admin-jwt>" \
     https://swingbyy-api.onrender.com/admin/monitoring-probe
   # expect HTTP 500, then the error "CARD-07 monitoring probe" appears in the
   # swingby-backend issue stream within ~1 minute.
   ```

Until step 2 is done, backend Sentry stays a silent no-op. Nothing in code needs
to change to turn it on — only the Render env var.
