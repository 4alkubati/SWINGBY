# Morning Brief — A-to-Z Setup Guide

> Goal for the next 2 hours: ONE brief landing on your phone tomorrow morning with 3 real numbers (visitors → waitlist → overnight build status).
> Rule: do steps 1–8. Step 9 (Resend) runs in the background. Step 10 (Gmail) only if time.
> SECURITY: every token/key goes into n8n's credential store + your password manager. Never paste keys into chat or commit them to git.

---

## PART 0 — Prep (2 min)

- [ ] Open **Docker Desktop** and wait until it says "Engine running" (bottom-left green).
- [ ] Have your phone handy (for Telegram).

---

## STEP 1 — Start n8n in Docker (10 min)

- [ ] Open **PowerShell** (or Terminal).
- [ ] Run these two lines:

```
docker volume create n8n_data
docker run -d --name n8n --restart unless-stopped -p 5678:5678 -v n8n_data:/home/node/.n8n -v "C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\memory:/data/memory:ro" docker.n8n.io/n8nio/n8n
```

> If the path errors, swap backslashes for forward slashes in that `-v "...:/data/memory:ro"` part.

- [ ] In a browser go to **http://localhost:5678**
- [ ] Create your local owner account (email + password — this is local only, your choice).

✅ Done when n8n loads in the browser.

---

## STEP 2 — Import the workflow (5 min)

- [ ] Top-left → **Workflows** → the **"..."** menu (or the down-arrow next to "Create Workflow") → **Import from File**.
- [ ] Choose: `C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\automation\morning_brief.workflow.json`
- [ ] The canvas shows 6 nodes: Schedule → Read Overnight Status, Gmail, Social Analytics → Compile Brief → Deliver.

✅ Done when you see the node graph.

---

## STEP 3 — Fix the file path (5 min)

- [ ] Double-click **"Read Overnight Status"** node.
- [ ] Set **File(s) Selector** to: `/data/memory/STATUS.md`
- [ ] (That's the mounted path from Step 1, not the Windows path.)
- [ ] Click **Execute step** — it should return the file contents.

✅ Done when the node returns text (not an error).

---

## STEP 4 — Telegram delivery (15 min) ← your easiest win

**4a. Create the bot**
- [ ] In Telegram, search **@BotFather** → open → send `/newbot`
- [ ] Give it a name (e.g. "SwingBy Brief") and a username ending in `bot`.
- [ ] BotFather replies with a **bot token** — paste it ONLY into n8n's credential store + your password manager. NEVER write it in this file or any file in the repo.

**4b. Get your chat ID**
- [ ] Search **@userinfobot** in Telegram → send it any message → it replies with your **Id** (a number — your chat ID). → save it to your password manager.
- [ ] Open your new bot and send it `hi` once (this lets the bot message you).

**4c. Wire it in n8n**
- [ ] Delete the **"Deliver Brief"** node (right-click → Delete).
- [ ] Click the **+** after "Compile Brief" → search **Telegram** → choose **Send a Text Message**.
- [ ] Credential → **Create New** → paste the **bot token** → Save.
- [ ] **Chat ID:** your number from 4b.
- [ ] **Text:** click the field, switch to expression (the `=` icon), enter: `{{ $json.brief }}`

✅ Done when the Telegram node is connected after Compile Brief.

---

## STEP 5 — Plausible analytics (10 min)

**5a. Get the key**
- [ ] Log in to Plausible → click your account name → **Settings** → **API Keys** (left sidebar) → **New API Key** → type **Stats API** → copy the key (shown once). → save to password manager.

**5b. Wire the HTTP node**
- [ ] Double-click **"Social Analytics"** node. Set:
  - **Method:** `POST`
  - **URL:** `https://plausible.io/api/v2/query`
  - **Authentication:** Generic → **Header Auth** → Create credential:
    - Name: `Authorization`  Value: `Bearer YOUR-PLAUSIBLE-KEY`
  - **Send Body:** ON → Body Content Type: **JSON** → paste:

```json
{ "site_id": "swingbyy.com", "metrics": ["visitors","pageviews"], "date_range": "7d" }
```

- [ ] **Execute step** — you should get visitor/pageview numbers back.

✅ Done when it returns numbers.

---

## STEP 6 — Notion waitlist count (10 min)

**6a. Make the integration**
- [ ] Go to **notion.so/my-integrations** → **New integration** → name it "n8n" → copy the **Internal Integration Token** (`secret_...` / `ntn_...`). → save to password manager.
- [ ] Open your **SwingBy Waitlist** database in Notion → top-right **...** → **Connections** → add your "n8n" integration. (Without this, n8n can't see it.)

**6b. Wire the node**
- [ ] On the canvas, click the **+** on the Schedule node's output (so it runs in parallel) → search **Notion** → **Database Page → Get Many**.
- [ ] Credential → Create New → paste the integration token.
- [ ] **Database:** select **SwingBy Waitlist**.
- [ ] **Return All:** ON.
- [ ] Rename this node to **"Notion Waitlist"** (double-click its title).
- [ ] Connect its output into **Compile Brief**.

✅ Done when it returns the list of waitlist rows (the count = number of items).

---

## STEP 7 — Update Compile Brief + test run (10 min)

**7a. Paste the brief code** (so it uses the 3 real sources)
- [ ] Double-click **"Compile Brief"** → replace the code with:

```javascript
const status = $('Read Overnight Status').first()?.json?.data || 'No overnight status found.';
const lastRun = String(status).split('\n').find(l => l.includes('Last Agent Run')) || 'See STATUS.md';
const social = $('Social Analytics').first()?.json?.results?.[0] || {};
const visitors = social.metrics?.[0] ?? social.visitors ?? 'n/a';
const waitlist = $('Notion Waitlist').all().length;

const brief = [
  `☀️ MORNING BRIEF — ${new Date().toISOString().slice(0,10)}`,
  ``,
  `BUILD (overnight): ${lastRun}`,
  `SITE (7d visitors): ${JSON.stringify(visitors)}`,
  `WAITLIST (total): ${waitlist}`,
  ``,
  `ONE THING: open PLAN.md → next domino.`
].join('\n');

return [{ json: { brief } }];
```

> If you skipped Gmail, right-click the **Gmail** node → **Deactivate** so it doesn't error.

**7b. Test**
- [ ] Click **Execute Workflow** (bottom).
- [ ] A brief should arrive in Telegram on your phone.
- [ ] Any red node → click it, read the error, fix (usually a credential or the field path). Re-run.

✅ Done when the brief hits your phone.

---

## STEP 8 — Schedule + activate (5 min)

- [ ] Double-click **"Schedule"** node → set Trigger to your wake time (cron `5 6 * * *` = 6:05am, or use the simple "Hours" picker).
- [ ] Top-right toggle → **Active** (green).
- [ ] Keep Docker Desktop running + PC awake overnight (`powercfg /change standby-timeout-ac 0`).

✅ Done — brief now fires automatically every morning.

---

## STEP 9 — Resend (start NOW, runs in background) (15 min)

> Domino 1 of your beta. DNS takes hours, so kick it off now and it's live by tonight.

- [ ] Go to **resend.com** → sign up.
- [ ] **Domains** → **Add Domain** → enter `swingbyy.com` (or your sending subdomain).
- [ ] Resend shows **DNS records** (SPF / DKIM / MX). Copy them.
- [ ] Log in to your domain host (where swingbyy.com DNS lives) → add those records exactly → save.
- [ ] **API Keys** → Create → copy the key. → save to password manager. (You'll paste it into the SwingBy backend env for Domino 1.)
- [ ] Come back in a few hours → Resend should show the domain **Verified**.

✅ Done when records are added (verification finishes on its own).

---

## STEP 10 — Gmail inbox (OPTIONAL — only if time) (15 min)

- [ ] In n8n, click the **Gmail** node → Credential → **Create New** → **Sign in with Google** (OAuth) → approve.
- [ ] If Google asks for a Cloud project / OAuth consent, that's the rabbit hole → **defer it**. Telegram + analytics + waitlist is a solid v1.
- [ ] If connected: set Operation = **Get Many**, Limit 10, Filter unread → reconnect into Compile Brief and add an inbox line.

---

## Credentials checklist (store in password manager)

- [ ] Telegram **bot token** + **chat ID**
- [ ] Plausible **Stats API key**
- [ ] Notion **integration token** (+ Waitlist DB shared with it)
- [ ] Resend **API key** + DNS access
- [ ] *(defer)* Gmail OAuth
- [ ] *(defer)* Meta Graph token (IG/FB) — only when you start posting to recruit testers

---

## If something breaks

- **n8n won't load:** Docker Desktop not running, or container didn't start → `docker logs n8n`.
- **Read Overnight Status errors:** path must be `/data/memory/STATUS.md`, and the `-v` mount must be in the run command.
- **Telegram silent:** you must message the bot once first; check the chat ID is the number, not the username.
- **Plausible 401:** the header must be `Authorization: Bearer <key>` exactly.
- **Notion empty:** you forgot to share the database with the integration (Step 6a).
