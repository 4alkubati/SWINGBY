---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build, tooling]
---
# Walkthrough diagnostics

Walk through SwingBy while it watches your eyes and listens to you talk. It
records where you looked, what you tapped, what the backend actually did, and
what you said — on one timeline — then tells you what looked wrong.

The point is to turn "I used it and something felt off" into a list with
timestamps and file names attached.

---

## What it records

| Signal | How | Worth |
|---|---|---|
| **Gaze** | webcam, via WebGazer | which element, for how long — not just x/y |
| **Voice** | live transcript + a `.webm` of the audio | your own verdict, in your words |
| **Taps / typing** | listeners inside the app | what you did, and what it did back |
| **Screens** | URL + the biggest heading | where you were at every moment |
| **Backend calls** | the harness proxies them | status and latency for every request |

Gaze is stored as *semantics*, not coordinates. Every sample is hit-tested
against the real DOM, so a look comes out as `2.4s on [button] Send quote`,
which still means something a week later.

---

## Running it

**One-time:** `mobile/node_modules` must be installed and owned by you. If it
was ever installed with `sudo`, Expo cannot resolve its config plugins and the
build fails:

```bash
sudo chown -R "$USER":"$USER" mobile/node_modules
cd mobile && npm install
```

**Every time:**

```bash
# 1. build the app pointed at the harness proxy
tools/walkthrough/build-app.sh

# 2. serve it
node tools/walkthrough/server.js --app tools/walkthrough/appbuild

# 3. open http://localhost:8080, calibrate, walk, talk

# 4. read the verdict
python3 tools/walkthrough/diagnose.py tools/walkthrough/sessions/<stamp>
```

Server options: `--api <url>` (default is the Render backend), `--port`,
`--out`.

### Point it at a local backend instead

By default the walkthrough talks to production, so anything you post during a
run lands in the real database. To keep test data out of it, run the backend
locally and aim the harness at it:

```bash
cd backend && python3 -m uvicorn app.main:app --reload --port 8000
node tools/walkthrough/server.js --app tools/walkthrough/appbuild --api http://127.0.0.1:8000
```

---

## The camera will not work over the LAN

Browsers only hand over a camera or microphone in a **secure context**:
`localhost`, or real HTTPS. `http://10.0.0.168:8080` gives you neither — the
page loads, and gaze and voice silently refuse to start. The harness detects
this and says so rather than looking broken.

Pick one:

**Run the browser on the same machine as the server** — simplest, nothing to
configure, `http://localhost:8080` is a secure context by definition.

**Tailscale HTTPS** — for driving it from the Windows laptop against the Linux
box. Gives a real certificate, no warnings:

```bash
tailscale serve --bg 8080
tailscale serve status     # prints the https://kiraserver.<tailnet>.ts.net URL
```

**Chrome flag** — last resort. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
add `http://10.0.0.168:8080`, enable, restart.

---

## How good is the eye tracking, really

WebGazer uses a plain webcam and lands within roughly **100–200 px** of where
you actually looked. On a 390 px-wide phone frame that is enough to say "he
never looked at the bottom third" or "he kept going back to that card", and
**not** enough to say which of two adjacent words he read. The analysis only
leans on the coarse signal, and every gaze finding is `medium` severity or
lower for that reason.

Things that wreck it: moving your head after calibrating, changing the
lighting, glasses with strong reflections, sitting differently than you did
during calibration. Recalibrate rather than trusting a drifting session — the
button is right there.

Leave the gaze dot on for your first run so you can see whether it is tracking
you at all. Then turn it off, because watching the dot changes where you look.

---

## Reading the output

`diagnose.py` writes two files next to `session.json`:

- **`report.md`** — the readable one. Signals ranked by severity, then the
  whole session on a single timeline.
- **`findings.json`** — the same thing structured, for handing to an agent.

### The signals

| Signal | Means |
|---|---|
| `stare` | looked at something >1.5s then did nothing — unclear or unreadable |
| `dead-tap` | tapped and nothing on screen changed |
| `rage-tap` | same target 3+ times in five seconds |
| `backtrack` | went somewhere and came straight back — wrong label |
| `unseen` | tapped something the tracker never saw you look at — you hunted for it |
| `api-error` | backend returned 4xx/5xx or the call failed |
| `api-slow` | over two seconds |
| `said-negative` | frustration or confusion in the narration |
| `marked` | you double-tapped space |

`said-negative` is a keyword match, not sentiment analysis. It exists to rank
moments for a human to look at, nothing more.

### Then hand it to Claude

The script deliberately stops at *what happened*. Mapping a finding onto the
function that caused it needs the repo open:

```
Read tools/walkthrough/sessions/<stamp>/findings.json and report.md.
For each high-severity finding, find the component or endpoint responsible
in mobile/src and backend/app, and tell me what to fix. Cite file:line.
Do not guess.
```

---

## Talk while you walk

The transcript carries more diagnostic weight than the gaze does. Narrate the
boring parts — "where's the button", "why is this empty", "I thought that would
do something". Silence produces a session with taps and no reasons.

Double-tap **space** whenever something feels wrong. It lands on the timeline
as a `marked` finding whether or not any automatic signal fired.

---

## What this is not

It runs the **web build** of the mobile app. React Native Web is close but not
identical to a real device: maps, the native date and time pickers, secure
storage, haptics and the image picker all behave differently or not at all.
`NearbyMapScreen` already has a separate `.web.js`, so the map is definitively
not what ships.

Use it for flow, copy, layout, discoverability and backend behaviour. Confirm
anything native on a real phone.

---

## Licensing

WebGazer is **GPLv3** (LGPLv3 for companies valued under $1M). It is downloaded
into `vendor/` on first run and is **not committed** — the licence stays off
SwingBy's tree. Nothing here ships in the app or on the website; it is a
development tool.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[FLOW_GRAPH]] · [[RUNNING_LOCALLY]] · [[SESSIONS]]
<!-- graph-wire:end -->
