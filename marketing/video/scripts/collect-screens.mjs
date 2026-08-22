#!/usr/bin/env node
/**
 * collect-screens — get real app screens into public/screens/, prove they are
 * distinct, and write the manifest that binds each one to a scene.
 *
 * WHY THE HASHING IS NOT OPTIONAL
 * -------------------------------
 * marketing/social-assets/render.js documents the bug this exists to prevent:
 * assets/01-home-top.png and assets/02-home-nearby.png are BYTE-IDENTICAL, so
 * two posts showed the same screen while claiming different things. Nothing
 * caught it because both files existed and both opened. Every capture here is
 * sha256'd and a duplicate is refused, loudly, with the name of the file it
 * duplicates.
 *
 * Do not copy captures out of marketing/social-assets/screens without running
 * them through this — that set is known to contain duplicates.
 *
 * USAGE
 *   node scripts/collect-screens.mjs                 # index + dedupe what is there
 *   node scripts/collect-screens.mjs --source=web --url=http://localhost:8081
 *   node scripts/collect-screens.mjs --source=adb    # a connected device/emulator
 *
 * The index/dedupe pass always runs, so dropping a PNG in by hand and re-running
 * is a supported workflow.
 */

import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, dirname, extname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SCREENS = join(ROOT, 'public', 'screens');
const MANIFEST = join(ROOT, 'src', 'screens', 'manifest.json');

/**
 * The scene binding. `screen` is the filename a beat in src/timeline.ts asks for.
 * The three anchors are the priority captures — a reel without them falls back to
 * placeholders and is not shippable.
 */
const SCENE_BINDING = [
  {scene: 'home',     screen: 'client-home.png',        anchor: true,  route: '/(client)/home',            label: 'Client Home'},
  {scene: 'confirm',  screen: 'active-booking.png',     anchor: true,  route: '/(client)/bookings/active', label: 'Active Booking'},
  {scene: 'business', screen: 'business-dashboard.png', anchor: true,  route: '/(business)/dashboard',     label: 'Business Dashboard'},
  {scene: 'details',  screen: 'job-details.png',        anchor: false, route: '/(client)/post/details',    label: 'Job Details'},
  {scene: 'quotes',   screen: 'quotes.png',             anchor: false, route: '/(client)/bookings/quotes', label: 'Quotes'},
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function capture() {
  if (!args.source) return {captured: 0, note: 'no --source given; indexing existing files only'};

  if (args.source === 'web') {
    const url = args.url || 'http://localhost:8081';
    let chromium;
    try {
      ({chromium} = await import('playwright'));
    } catch {
      throw new Error(
        'playwright is not installed. `npm i -D playwright && npx playwright install chromium`, ' +
          'or capture with --source=adb.',
      );
    }
    const browser = await chromium.launch();
    // A real phone viewport. Capturing at desktop width and scaling down is how
    // you get a screenshot whose type is too small to read on the phone frame.
    const ctx = await browser.newContext({
      viewport: {width: 390, height: 844},
      deviceScaleFactor: 3,
      isMobile: true,
    });
    const page = await ctx.newPage();
    let n = 0;
    for (const b of SCENE_BINDING) {
      const target = `${url}${b.route}`;
      try {
        await page.goto(target, {waitUntil: 'networkidle', timeout: 30_000});
        // Never capture a spinner or an empty state — the pacing rule says cut
        // dead time, and a loading frame is dead time that also lies.
        await page.waitForTimeout(1200);
        await page.screenshot({path: join(SCREENS, b.screen), fullPage: false});
        n++;
        console.log(`  captured ${b.screen}  <- ${b.route}`);
      } catch (e) {
        console.warn(`  SKIP ${b.screen}: ${e.message.split('\n')[0]}`);
      }
    }
    await browser.close();
    return {captured: n};
  }

  if (args.source === 'adb') {
    const {execFile} = await import('node:child_process');
    const {promisify} = await import('node:util');
    const run = promisify(execFile);
    console.log('  adb: capturing the CURRENT screen only — drive the app by hand between runs.');
    const name = args.name || 'capture.png';
    const {stdout} = await run('adb', ['exec-out', 'screencap', '-p'], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
    await writeFile(join(SCREENS, name), stdout);
    console.log(`  captured ${name}`);
    return {captured: 1};
  }

  throw new Error(`unknown --source=${args.source} (use web or adb)`);
}

async function indexAndDedupe() {
  await mkdir(SCREENS, {recursive: true});
  await mkdir(dirname(MANIFEST), {recursive: true});

  const files = (await readdir(SCREENS)).filter((f) =>
    ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(f).toLowerCase()),
  );

  const byHash = new Map();
  const entries = [];
  const duplicates = [];

  for (const f of files.sort()) {
    const p = join(SCREENS, f);
    const buf = await readFile(p);
    const h = sha(buf);
    const {size} = await stat(p);
    if (byHash.has(h)) {
      duplicates.push({file: f, duplicateOf: byHash.get(h)});
      continue;
    }
    byHash.set(h, f);
    const bound = SCENE_BINDING.find((b) => b.screen === f);
    entries.push({
      file: f,
      sha256: h.slice(0, 16),
      bytes: size,
      scene: bound?.scene ?? null,
      label: bound?.label ?? basename(f, extname(f)),
      anchor: bound?.anchor ?? false,
      usable: true,
    });
  }

  const missingAnchors = SCENE_BINDING.filter(
    (b) => b.anchor && !entries.some((e) => e.file === b.screen),
  ).map((b) => b.label);

  const manifest = {
    generated: 'run `npm run collect` to regenerate',
    note:
      'Each entry binds a capture to a scene in src/timeline.ts. A scene whose ' +
      'file is absent renders its own placeholder, so the reel always composes.',
    anchors: SCENE_BINDING.filter((b) => b.anchor).map((b) => b.label),
    missingAnchors,
    duplicates,
    screens: entries,
  };

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

const res = await capture();
if (res.note) console.log(`collect: ${res.note}`);
const m = await indexAndDedupe();

console.log(`\ncollect: ${m.screens.length} distinct screen(s) in public/screens/`);
for (const e of m.screens) {
  console.log(`  ${e.anchor ? 'ANCHOR' : '      '}  ${e.file}  ${e.scene ?? '(unbound)'}  ${e.sha256}`);
}
if (m.duplicates.length) {
  console.error(`\ncollect: ${m.duplicates.length} BYTE-IDENTICAL duplicate(s) — not indexed:`);
  for (const d of m.duplicates) console.error(`  ${d.file} is identical to ${d.duplicateOf}`);
  console.error('  This is the social-assets bug. Re-capture the screen you actually meant.');
}
if (m.missingAnchors.length) {
  console.warn(`\ncollect: missing anchor capture(s): ${m.missingAnchors.join(', ')}`);
  console.warn('  Those scenes will render placeholders. Not shippable until captured.');
}
console.log(`\ncollect: manifest -> src/screens/manifest.json`);
