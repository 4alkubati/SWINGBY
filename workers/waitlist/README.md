# swingby-waitlist Worker

The Cloudflare Worker behind `https://api.swingbyy.com/waitlist`. It takes the
name/email from the pre-launch form on swingbyy.com and writes a row into the
Notion waitlist database.

SB-0051: there was no runbook for any of this. The Worker was deployed once, by
hand, and how to redeploy it or set its secret existed only in whoever did it
last — which is the same as not existing. Everything below is verifiable from
the repo or the Cloudflare dashboard.

## What it is

| | |
|---|---|
| Worker name | `swingby-waitlist` |
| Route | `api.swingbyy.com/waitlist*` |
| Source | `workers/waitlist/index.js` (no build step, no dependencies) |
| Config | `workers/waitlist/wrangler.toml` |
| Cloudflare account | `4877404e65143359d52e1056bfd8099c` |
| Zone (`swingbyy.com`) | `9a8b894bb479321547e40824477d46f5` |

It is **not** the FastAPI backend. `web/pre-launch/.env.production` points
`VITE_API_URL` at `https://api.swingbyy.com` — this Worker — while the app's
other calls go to `https://swingbyy-api.onrender.com`. Both origins are in the
site's CSP `connect-src`; removing either breaks a form (SB-0039).

## Deploying

From the repo root:

```bash
cd workers/waitlist
npx wrangler@3 deploy
```

`wrangler` will prompt for a browser login the first time. To deploy from CI or
a headless box, set `CLOUDFLARE_API_TOKEN` (scope: *Workers Scripts:Edit*) and
`CLOUDFLARE_ACCOUNT_ID` instead.

Verify it actually shipped — a successful `deploy` is not proof the route is
serving:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.swingbyy.com/waitlist/
# 405 — the Worker is live and refusing GET, which is correct.

curl -s -X POST https://api.swingbyy.com/waitlist/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Runbook Check","email":"runbook@example.com"}'
# {"message":"You're on the list! We'll be in touch."}
```

Then confirm the row landed in the Notion database. A 200 means the Worker
accepted it; only Notion can confirm it was stored.

## The secret

The Worker needs `NOTION_TOKEN` — a Notion internal-integration token with
access to the waitlist database. It is a Worker **secret**, not a `var`: it
must never be written into `wrangler.toml`, which is committed.

```bash
cd workers/waitlist
npx wrangler@3 secret put NOTION_TOKEN
# paste the token at the prompt; it is not echoed and not stored locally

npx wrangler@3 secret list        # confirm the name is present (values never shown)
```

Rotating it: create the new token in Notion, `secret put` it (this overwrites),
verify with the curl above, then revoke the old one in Notion. In that order —
revoking first takes the form down for as long as it takes you to notice.

If `NOTION_TOKEN` is unset or wrong, the Worker returns
`502 {"detail":"Could not join the waitlist. Please try again."}` and logs the
real reason. It deliberately does **not** return Notion's error body any more:
that body carries database ids and API diagnostics, and this endpoint is public
with `Access-Control-Allow-Origin: *` (SB-0041).

## Watching it

```bash
npx wrangler@3 tail swingby-waitlist        # live logs, including the errors above
```

The failure mode with no logs and no alert is the one that matters: the form
appears to work, returns 502, and nobody finds out until someone asks why the
waitlist stopped growing. There is no alerting on this Worker today — that is a
known gap, not an oversight.
