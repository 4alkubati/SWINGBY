const { chromium } = require('/home/l3thal/tmpbig/node_modules/playwright');
const path = require('path');
const OUT = '/home/l3thal/tmpbig/posts/out';
require('fs').mkdirSync(OUT, {recursive:true});

// CORRECTED 2026-08-12. FACTS.md §9 raised this file on 2026-08-08: the comment
// that used to sit here claimed "Claims are constrained by roles/FACTS.md
// discipline." It was not. The POSTS array shipped four banned claims —
// "18 verified pros" (an invented supply count AND an unbacked verification
// claim, §4), "Real ratings from finished jobs" (§4, we have no reviews),
// "Verified before they can bid" (§4, describes a gate that does not exist) and
// "No subscription" (§2.2, a business subscription is real). <!-- lint-ok -->
//
// Two more problems this file has that copy alone does not fix:
//
//   1. post.html hardcodes the wordmark as Swing<span>By</span> — the dead
//      one-y name (§0) — on every frame it renders.
//   2. assets/01-home-top.png and assets/02-home-nearby.png are BYTE-IDENTICAL,
//      so posts 02 and 03 show the same screen while claiming different things.
//      Verify before trusting any capture in assets/.
//
// The renderer itself is good — template, tokens and fonts are fine. Every
// claim below now cites the FACTS section it stands on. If you add a post and
// cannot cite one, it does not ship.
const POSTS = [
  { file:'01-live',
    shot:'03-live-booking.png',
    eyebrow:'Happening now',
    head:'Follow the job<br>from <span class="g">confirmed to done</span>.',
    sub:'Confirmed, on the way, in progress, done.',
    // §3 live status stepper (progress only — not tracking, not ETA, not
    // live location). §2 approved longer form for the payment line.
    proof:'Live status, not a phone call|Message them in the app|Payment held until you approve',
    foot:'Calgary · Not on the App Store yet' },

  { file:'02-nearby',
    shot:'01-home-top.png',
    eyebrow:'Posting a job',
    head:'You set a budget.<br>Nobody bidding <span class="g">sees it</span>.',
    sub:'Businesses quote their own price, not yours.',
    // §3.2 pre-acceptance masking. Photos ARE shown — corrected 08-11,
    // privacy.py:149 keeps image_urls. Never write "no photos".
    proof:'They see the work, your photos and the area|Not your name, address, or budget|You get their price, not yours',
    foot:'Calgary · Not on the App Store yet' },

  { file:'03-escrow',
    shot:'02-home-nearby.png',
    eyebrow:'How you pay',
    head:'Nothing moves<br>until <span class="g">you approve</span>.',
    sub:'The full amount is held until the job is done.',
    // §2: the FULL amount is held (compute_hold_cents), the cut comes out at
    // release, and APPROVAL is the trigger — never completion, never a timer.
    proof:'The full amount held, not part of it|Before and after photos on the job|You approve — then it is released',
    foot:'Calgary · Not on the App Store yet' },
];

(async () => {
  const b = await chromium.launch({
    executablePath:'/home/l3thal/.cache/ms-playwright/chromium-1134/chrome-linux/chrome',
    args:['--no-sandbox','--disable-dev-shm-usage','--force-color-profile=srgb']});
  const ctx = await b.newContext({viewport:{width:1080,height:1350}, deviceScaleFactor:2});
  const p = await ctx.newPage();
  for (const post of POSTS) {
    const q = new URLSearchParams({eyebrow:post.eyebrow, head:post.head, sub:post.sub,
                                   proof:post.proof, foot:post.foot, shot:post.shot,
                                   ...(post.croph?{croph:String(post.croph)}:{})});
    await p.goto('file://' + path.join(__dirname,'post.html') + '?' + q.toString(),
                 {waitUntil:'load'});
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(900);
    await p.screenshot({path:`${OUT}/${post.file}.png`});
    console.log('  ✓', post.file);
  }
  await b.close();
})();
