# Swingbyy video engine

Remotion + TypeScript. Collects real app screens and produces branded,
muted-safe demo videos. **Vertical 9:16 is primary.**

Runs on the laptop (RTX 4060). It is not expected to render on kiraserver —
that box has 3.2 GB and the reel renderer already fights for it.

```bash
npm install
npm run studio            # the motion editor — see below
npm run collect           # capture + dedupe app screens
npm run render:reel       # 1080x1920 -> out/
python ../../tools/claim_lint.py marketing/video
```

---

## The motion editor (the scrubber)

`npm run studio` opens **Remotion Studio**, which is the timeline editor:

- Every beat is its own `<Sequence>`, so it appears as **its own bar** in the
  timeline, named `scene:home`, `scene:confirm`, `outro:outro` and so on.
- **Click a bar** to jump the playhead to that scene.
- **Drag a bar's edge** to trim or retime it — that is the retiming workflow.
- The **Tweaks / props panel** edits `defaultProps` live, so you can swap the
  CTA or a screen filename without touching code.
- The scrubber at the top scrubs the whole composed reel.

One `<Sequence>` per beat is deliberate. Collapsing beats into a single
component would render an identical video and take the editing surface away.

When a retime is one you want to keep, copy the frame count back into
`src/timeline.ts` — the Studio edits the running preview, not the file.

---

## Layout

| Path | What it is |
|---|---|
| `src/theme.ts` | Brand tokens. **Mirrors `design/tokens.md`** — change both together. |
| `src/motion.ts` | `design/MOTION.md` curves: entry 240ms ease-out, exit 180ms ease-in, spring 220/22. |
| `src/camera.ts` | Camera presets: `glide`, `tilt`, `rotate`, `pushIn`, `pullBack`, `combine`. |
| `src/captions.ts` | **Every word that reaches a frame.** Each caption cites a FACTS section. |
| `src/cta.ts` | The CTA enum — three allowed outros, no free text. |
| `src/timeline.ts` | The beats, as data, plus the templates. |
| `src/Reel.tsx` | The orchestra: beats -> `<Sequence>`s. |
| `src/components/` | `PhoneFrame`, `Caption`, `Hook`, `ZoomTo`, `Logo`, `Outro`, `Scene`. |
| `public/screens/` | The captures. Referenced by filename from `timeline.ts`. |
| `src/screens/manifest.json` | Generated. Binds captures to scenes, records hashes. |
| `out/` | Rendered videos + `catalog.json`. |

## Compositions

| id | size | use |
|---|---|---|
| `reel-9x16` | 1080x1920 | **primary** |
| `square-1x1` | 1080x1080 | feed |
| `wide-16x9` | 1920x1080 | site / deck |
| `tpl-*` | 1080x1920 | one per template, scrubbable directly |

## Templates

- **`cinematic-glide`** — the default. Hook -> Home -> Details -> Quotes ->
  Confirm -> Outro, slow camera moves.
- **`logo-bookend`** — the literal Logo -> ... -> Logo order.
- **`quick-cut-feature-tour`** — shorter beats, six of them, no zoom dwell.
- **`single-feature-spotlight`** — one fact (pre-acceptance privacy), room to breathe.

> **One judgement call to confirm.** The brief listed the scenes as
> `Logo -> Home -> Details -> Quotes -> Confirm -> Logo`. `cinematic-glide` opens
> on the **Hook** instead of the wordmark, because a muted viewer decides in the
> first ~1.5s and the wordmark has no equity to trade on before launch. The
> literal order is one composition away as `logo-bookend` — switch
> `DEFAULT_TEMPLATE` in `src/Root.tsx` if you disagree.

---

## Collecting screens

```bash
npm run collect                                   # index + dedupe what is there
node scripts/collect-screens.mjs --source=web --url=http://localhost:8081
node scripts/collect-screens.mjs --source=adb --name=client-home.png
```

Three **anchor** captures: Client Home, Active Booking, Business Dashboard. A
reel missing one renders that scene's placeholder and is not shippable.

**Every capture is sha256'd and byte-identical duplicates are refused.** This is
not paranoia: `marketing/social-assets/` ships `01-home-top.png` and
`02-home-nearby.png` byte-identical, so two posts showed the same screen while
claiming different things. Do not copy captures out of that directory without
running them through `collect`.

Every scene has its own placeholder, so the whole reel composes and scrubs
before a single real capture exists.

---

## Real app footage from the iPhone

**Live screen mirroring from Windows does not exist.** No QuickTime (Mac only),
no `libimobiledevice` Developer Disk Image mount, no iOS equivalent of `scrcpy`.
Verified on this laptop 2026-08-21. So the phone is not a live source.

What does work, and is the supported path:

1. On the iPhone, record the app with **iOS Screen Recording** (Control Centre).
2. Plug the phone into the laptop and unlock it.
3. Pull the file:

```powershell
powershell -File scripts/pull-iphone.ps1 -List
powershell -File scripts/pull-iphone.ps1 -Name IMG_1234.MOV -Dest .\ingest
```

4. Move it to `public/screens/`, run `npm run collect`, and point a beat at it:

```ts
{...BEAT.confirm(), screen: 'active-booking.mov', startFrom: 2.5}
```

`PhoneFrame` renders `.mov`/`.mp4` through `<OffthreadVideo>` and stills through
`<Img>` — same prop, detected by extension. `startFrom` is in seconds and exists
because a screen recording always opens with a fumble for the record button.

iOS exposes the camera roll over MTP, not as a drive letter, which is why the
puller uses `Shell.Application.CopyHere` and then waits for the file to settle
rather than trusting the call to be synchronous.

**Shoot as the demo account** (`nadia-whitfield@demo.swingbyy.com`), not your
own. A personal capture carries real booking names, and the status bar carries
your battery and notifications.

---

## Docker

```bash
docker compose up studio          # motion editor on :3000
docker compose run --rm render    # render reel-9x16 into out/
```

`src/`, `public/` and `out/` are bind-mounted, so edits on the host appear live
and rendered files land on the host. `node_modules` stays inside the image.

**Studio already binds every interface** — it prints a `Network:` URL on start.
With the laptop on Tailscale you can open the timeline from your phone's browser
at `http://<tailscale-ip>:3000` and retime scenes there. On an untrusted network,
change the port mapping to `127.0.0.1:3000:3000`.

Remotion cannot run *on* an Android phone: rendering needs a headless Chromium
and there is no dependable one for Termux. The phone is the screen, the laptop
is the engine.

On Windows the Docker Desktop engine must be started from the desktop session
first — it cannot be brought up over SSH.

---

## Rendering

```bash
npm run render:reel       # concurrency is pinned to 50% in remotion.config.ts
npm run catalog           # -> out/catalog.json
```

Naming convention: `<template>__<aspect>__<cta>.mp4`, e.g.
`cinematic-glide__9x16__waitlist.mp4`. The CTA is in the filename because all
three allowed CTAs expire when the App Store listing goes live in Oct 2026 —
re-cutting then should be a glob, not an audit.

Concurrency is capped at 50% deliberately (Kira, 2026-08-20). Remotion otherwise
takes every core, and the laptop also hosts the 36B crew model.

---

## The rules this project enforces in code

1. **The wordmark is `Swingbyy`** — capital S, two y's. It lives in `theme.ts`
   as `WORDMARK` and is never inlined. `marketing/social-assets/post.html`
   hardcodes the dead one-y name on every frame it renders; `claim_lint` fails
   the build on it.
2. **No store-install CTA.** FACTS section 5 — the listing is Oct 1-10, 2026.
   Outros take a `CtaKey` from `src/cta.ts`, one of *join the waitlist*,
   *follow for updates*, *Calgary businesses — early access*. A free-text CTA is
   not expressible.
3. **Every caption is a claim.** Captions live only in `src/captions.ts`, each
   with a required `facts` citation; `assertCaption()` throws at render time if
   it is missing. `marketing/video/` is in `claim_lint`'s `PUBLIC_PREFIXES`, so
   the section 4 (social proof) and section 5 (launch state) rules apply here.
   **There is deliberately no payment or escrow copy anywhere in this project** —
   FACTS section 2.5 is a standing freeze and the staged-split claim has been
   killed four times.
4. **Brand tokens** mirror `design/tokens.md`. Purple sparingly, money green,
   Space Grotesk 700 headings, Inter body, 12px buttons, **zero emoji**,
   Feather icons only.
5. **Motion** is `design/MOTION.md`, so marketing motion reads as the app.
   Camera moves run longer than MOTION.md's 400ms cap — that cap governs
   user-initiated UI transitions, and a camera glide is ambient motion, the same
   exemption MOTION.md already grants the Live Pulse. Documented in `motion.ts`.
6. **Pacing.** `Scene` throws below 45 frames or above 210 (1.5s–7s at 30fps).
   Dead time fails the render instead of shipping.

## Upgrade path: photoreal phone

`PhoneFrame` is CSS 3D — fast and deterministic under headless Chromium. For
photoreal glides, install `@remotion/three` and swap the div stack for a
`<ThreeCanvas>` mesh, driven by the **same `Camera` object** the component
already takes. Scenes and templates need no changes. Kept as the default because
three raises per-frame cost and this machine is shared. Full note in
`src/components/PhoneFrame.tsx`.

## Later: publishing

Standalone for now. The captions in `src/captions.ts` can later feed the hermes
`studio/queue.json` publish flow (`tools/social_post.py` is the publisher — do
not build another). Anything that goes that way stays gated by `claim_lint` in
CI.
