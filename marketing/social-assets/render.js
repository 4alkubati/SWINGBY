const { chromium } = require('/home/l3thal/tmpbig/node_modules/playwright');
const path = require('path');
const OUT = '/home/l3thal/tmpbig/posts/out';
require('fs').mkdirSync(OUT, {recursive:true});

// Claims are constrained by roles/FACTS.md discipline: escrow release on
// approval and the live timeline are real (approvals.py, booking_events).
// Nothing here promises half-at-booking or anything else the code doesn't do.
const POSTS = [
  { file:'01-live',
    shot:'03-live-booking.png',
    eyebrow:'Happening now',
    head:'Watch the job<br>actually <span class="g">happen</span>.',
    sub:'Confirmed, on the way, in progress, done.',
    proof:'Live status, not a phone call|Message the pro in the app|Payment held until you approve',
    foot:'Post a job free · Calgary trades' },

  { file:'02-nearby',
    shot:'01-home-top.png',
    eyebrow:'Browse nearby',
    head:'18 verified pros,<br>already <span class="g">near you</span>.',
    sub:'Cleaning, plumbing, painting, moving and more.',
    proof:'Real ratings from finished jobs|Verified before they can bid|Compare quotes side by side',
    foot:'Free to post · No subscription' },

  { file:'03-escrow',
    shot:'02-home-nearby.png',
    eyebrow:'How you pay',
    head:'Your money moves<br>when <span class="g">you say so</span>.',
    sub:'Held safely until the work is approved.',
    proof:'Nothing charged to post a job|Held in escrow, not sent early|Released when you approve',
    foot:'swingbyy.com · Calgary, AB' },
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
