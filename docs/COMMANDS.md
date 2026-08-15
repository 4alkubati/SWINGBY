# SwingBy — every command, one page

> Pin this. Everything below was read out of the repo (Makefile, `package.json`,
> `eas.json`, `tools/*`, `.github/workflows/`), not from memory. Paths are from
> the repo root unless a command says otherwise.

---

## 0. The five you'll actually use

```bash
make status                                   # computed truth about repo + prod, opens the page
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
cd mobile  && npx expo start --clear
python3 tools/e2e_smoke.py                    # full booking loop vs local backend
cd mobile  && npx eas build --profile preview --platform ios
```

---

## 1. Run it locally

### Backend — FastAPI, from `backend/`

```bash
cd backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**It will not boot with an empty `SECRET_KEY`.** `backend/.env` currently has one.
Either fill it in, or export a throwaway for the session:

```bash
export SECRET_KEY="dev-only-not-a-real-key"
```

`SUPABASE_SERVICE_KEY` is also required — the app hard-fails without it.

Health checks once it's up:

```bash
curl -s localhost:8000/healthz
curl -s localhost:8000/health | python3 -m json.tool
```

### Mobile — Expo, from `mobile/`

```bash
cd mobile
npx expo start --clear      # --clear wipes the Metro cache; use it after any dep change
npm run android             # expo start --android
npm run ios                 # expo start --ios
```

Device URLs, set as `EXPO_PUBLIC_API_URL` in `mobile/.env`:

| Target | URL |
|---|---|
| Physical device on the LAN | `http://10.0.0.168:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| Production | `https://swingbyy-api.onrender.com` |

### Web — Vite, from each site's folder

```bash
cd web/pre-launch && npm install && npm run dev     # coming-soon + waitlist
cd web/launch     && npm install && npm run dev     # the 40-route launch site
cd web/admin      && npm install && npm run dev     # analytics dashboard
```

`npm run build` and `npm run preview` work in all three.
`web/launch` alone has a linter:

```bash
cd web/launch && npm run lint
```

---

## 2. Tests

### Backend — pytest

```bash
cd backend
.venv/bin/python -m pytest tests -q              # full suite
.venv/bin/python -m pytest tests/test_escrow.py -q
.venv/bin/python -m pytest tests -q -k "escrow or refund"
```

From a **worktree** the venv and `.env` don't exist — export dummy values first,
they're enough to import the app:

```bash
export SECRET_KEY=x SUPABASE_URL=http://localhost SUPABASE_KEY=x SUPABASE_SERVICE_KEY=x
```

### Mobile — jest

**Do not run the full suite on this box — it takes ~2.4 hours.** Targeted files
take 5–25 seconds:

```bash
cd mobile
npx jest src/__tests__/post-job-date.test.js -w 2
npx jest -t "escrow" -w 2
npm run test:watch
```

`npm run test:ci` (`jest --ci --runInBand`) is what CI uses. Leave it to CI.

### End-to-end — the booking loop

```bash
python3 tools/e2e_smoke.py                     # vs http://127.0.0.1:8000
python3 tools/e2e_smoke.py http://10.0.0.168:8000
python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com
```

Post → quote → accept → booking → complete, with response-shape checks.
**Mandatory before accepting any change to the booking loop.** Uses the test
accounts in `CLAUDE.md`.

---

## 3. Builds — EAS

From `mobile/`. Profiles are defined in `mobile/eas.json`.

```bash
cd mobile
npx eas login
npx eas whoami

npx eas build --profile development --platform ios      # dev client, internal
npx eas build --profile preview     --platform ios      # internal test build
npx eas build --profile preview     --platform android  # APK
npx eas build --profile testflight  --platform ios      # store distribution
npx eas build --profile production  --platform ios

npx eas build:list --limit 5
npx eas build:view <BUILD_ID>
```

**Before the build runs, these must be set or it fails / ships broken:**

| Variable | If missing |
|---|---|
| `EXPO_PUBLIC_API_URL` | build **fails** |
| `GOOGLE_MAPS_API_KEY` | silently blank maps |

Over-the-air updates (no store round-trip, JS only):

```bash
npx eas update --branch preview    --message "what changed"
npx eas update --branch production --message "what changed"
```

Submission (`eas.json` still has `REPLACE_WITH_APPLE_ID_EMAIL` /
`REPLACE_WITH_ASC_APP_ID` — fill those first). Apple Team ID is `ZTYJ33HPDX`:

```bash
npx eas submit --profile testflight --platform ios
```

---

## 4. Deploy

### Backend — Render

Auto-deploys from `main` (`backend/render.yaml`, `autoDeploy: true`, `plan: free`).

```bash
git push origin main        # that is the deploy
```

> **Free plan spins down when idle.** The first request after a quiet period
> takes 30–60s to answer while the instance wakes. This is why the app can feel
> like it needs several login attempts before one succeeds.

### Web — Cloudflare Pages, via GitHub Actions

Pushing to `main` triggers `.github/workflows/web-prelaunch-deploy.yml` and
`web-launch-deploy.yml`. Manual equivalent:

```bash
cd web/launch && npm run build
npx --yes wrangler@3 pages deploy dist --project-name=swingby-prelaunch
npx --yes wrangler@3 pages project list        # confirm the project name first
```

### Worker — waitlist

```bash
cd workers/waitlist
npx wrangler deploy
npx wrangler tail --name swingby-waitlist      # live logs
```

---

## 5. Rollback

```bash
# Backend / web — revert the commit, Render and Pages redeploy from main
git log --oneline -10
git revert <BAD_COMMIT_SHA> --no-edit
git push origin main

# Mobile — republish the previous JS over the air
npx eas update --branch production --message "rollback regression in feature X"

# Worker
npx wrangler deployments list --name swingby-waitlist
npx wrangler rollback <DEPLOYMENT_ID> --name swingby-waitlist
```

Full procedure: `docs/ROLLBACK.md`.

---

## 6. Repo tools

```bash
make status                    # repo + prod facts, regenerates and opens the page
make status-git                # git facts only, skips the database
make status-open               # regenerate, don't open a browser

python3 tools/flow_graph.py    # regenerate docs/FLOW_GRAPH.md + flow-graph.json
python3 tools/claim_lint.py    # catch banned marketing claims before they ship
python3 tools/status.py --no-db

python3 tools/notify.py --check                   # what's configured
python3 tools/notify.py "deploy is green"         # DRY RUN — prints, sends nothing
python3 tools/notify.py "deploy is green" --send  # actually sends to Telegram
make status-open && python3 tools/notify.py --file .status/summary.txt --send
```

`make status` wants `DATABASE_URL` exported for the production section;
without it, it prints the SQL for pasting into the Supabase editor instead.

---

## 7. Knowledge graph — cheaper than grep

```bash
graphify update .                                     # rebuild, ~60s, no LLM, zero tokens
graphify query "how does escrow release" --budget 1500
graphify god-nodes --top 10
graphify affected "compute_completion_release_cents"
graphify path "PostJobScreen" "release_escrow_on_complete"
graphify explain "settle_on_accept"
```

> ⚠️ **`affected` under-reports module-qualified calls.** For anything that moves
> money, confirm the caller list with `grep -rn` before trusting it.

Rebuild after any significant merge — a stale graph points at moved line numbers.

---

## 8. Git / PRs

```bash
gh pr list --state open --limit 30
gh pr view <N>
gh pr checks <N>
gh pr merge <N> --squash

git log --oneline -20
git ls-tree origin/main <path>     # the done-rule: if it isn't here, it isn't done
```

---

## 9. Test accounts

| Role | Email | Password |
|---|---|---|
| Client | `testclient@swingby.dev` | `SwingBy2024!` |
| Business | `testbusiness@swingby.dev` | `SwingBy2024!` |
| Admin | `amrbasem37@gmail.com` | — |

The business account is **Douglas Glen Cleaning Co.** (Calgary) and has an active
non-owner employee, so it always takes the "assign someone before completing"
branch — it never exercises the solo-owner auto-assign path.
