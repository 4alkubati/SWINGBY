/**
 * SwingBy walkthrough recorder.
 *
 * Raw gaze coordinates are close to useless for diagnosing a UI — "he looked at
 * (203, 511)" tells you nothing a week later. So everything here exists to turn
 * gaze into SEMANTICS: which element, with what text, on which screen, for how
 * long, and what was being said at that moment.
 *
 * The app runs same-origin in an iframe, so every gaze sample can be hit-tested
 * against the real DOM with elementFromPoint.
 *
 * Accuracy, honestly: webcam gaze lands within roughly 100–200px of truth. On a
 * 390px-wide phone frame that is enough to tell "top card vs bottom card" or
 * "he never looked at the CTA at all", and NOT enough to tell which of two
 * adjacent words he read. The analysis leans only on the coarse signal.
 */
'use strict';

// ── state ────────────────────────────────────────────────────────────────────
const S = {
  recording: false,
  t0: 0,
  events: [],      // every timestamped thing that happened
  utterances: [],  // speech, separated out for easy reading
  calibrated: false,
  gazeOn: false,
  fixation: null,  // open gaze cluster
  lastScreen: null,
  counts: { gaze: 0, tap: 0, say: 0 },
  mediaRecorder: null,
  audioChunks: [],
  recognition: null,
};

const $ = (id) => document.getElementById(id);
const frame = $('app');
const now = () => Math.round(performance.now() - S.t0);

// getUserMedia only exists in a secure context; say so up front rather than
// failing mysteriously when the user hits Start.
const SECURE = window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
if (!SECURE) {
  $('secureWarn').style.display = 'block';
  $('useGaze').checked = false;
  $('useVoice').checked = false;
}

// ── event log ────────────────────────────────────────────────────────────────
function log(kind, data, label) {
  const e = { t: now(), kind, ...data };
  S.events.push(e);

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML =
    `<span class="t">${(e.t / 1000).toFixed(1)}s</span>` +
    `<span class="k ${kind}">${kind}</span>` +
    `<span class="v"></span>`;
  row.querySelector('.v').textContent = label || '';
  const feed = $('feed');
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

function bump(k) {
  S.counts[k]++;
  $({ gaze: 'nGaze', tap: 'nTap', say: 'nSay' }[k]).textContent = S.counts[k];
}

// ── describing a DOM node in words ───────────────────────────────────────────
// React Native Web renders Text as plain divs and Pressables as role=button
// (or a div carrying tabindex), so we climb until we find something a human
// would recognise, and keep both the leaf text and its enclosing control.
function describe(el) {
  if (!el) return null;

  let leafText = '';
  if (el.children.length === 0 && el.innerText) leafText = el.innerText.trim().slice(0, 80);

  let node = el;
  let control = null;
  for (let i = 0; i < 10 && node && node !== frame.contentDocument.body; i++) {
    const role = node.getAttribute && node.getAttribute('role');
    const aria = node.getAttribute && node.getAttribute('aria-label');
    const tid = node.getAttribute && (node.getAttribute('data-testid') || node.getAttribute('data-test-id'));
    const tabbable = node.hasAttribute && node.hasAttribute('tabindex');
    if (role === 'button' || role === 'link' || aria || tid || tabbable ||
        node.tagName === 'BUTTON' || node.tagName === 'INPUT') {
      control = {
        role: role || node.tagName.toLowerCase(),
        label: aria || tid || (node.innerText || '').trim().slice(0, 60) || null,
      };
      break;
    }
    if (!leafText && node.innerText && node.children.length === 0) {
      leafText = node.innerText.trim().slice(0, 80);
    }
    node = node.parentElement;
  }

  if (!leafText && el.innerText) leafText = el.innerText.trim().slice(0, 80);

  const r = el.getBoundingClientRect();
  return {
    text: leafText || null,
    control,
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    tag: el.tagName ? el.tagName.toLowerCase() : null,
  };
}

// A stable-ish identity so consecutive samples on the same thing cluster.
function targetKey(d) {
  if (!d) return 'offscreen';
  return (d.control ? 'c:' + d.control.label : '') + '|t:' + (d.text || '') + '|' + d.rect.y;
}

function describeShort(d) {
  if (!d) return '(outside the phone)';
  if (d.control && d.control.label) return `[${d.control.role}] ${d.control.label}`;
  if (d.text) return `"${d.text}"`;
  // Unlabelled box — say where it is, since "<div>" is useless a week later.
  if (d.rect && d.rect.w) return `unlabelled ${d.rect.w}×${d.rect.h} at y=${d.rect.y}`;
  return `<${d.tag || '?'}>`;
}

// ── which screen are we on ───────────────────────────────────────────────────
// Only 7 screens have URL paths in linking.js, so the URL alone can't identify
// a screen. The biggest piece of text near the top is a better label, and it is
// what the user would call the screen anyway.
function currentScreen() {
  try {
    const doc = frame.contentDocument;
    const path = frame.contentWindow.location.pathname.replace(/^\/app/, '') || '/';
    let best = null, bestSize = 0;
    const nodes = doc.querySelectorAll('div,span,h1,h2');
    for (let i = 0; i < Math.min(nodes.length, 600); i++) {
      const n = nodes[i];
      if (n.children.length !== 0 || !n.innerText) continue;
      const r = n.getBoundingClientRect();
      if (r.top < 0 || r.top > 380 || r.width < 20) continue;
      const size = parseFloat(getComputedStyle(n).fontSize) || 0;
      if (size > bestSize) { bestSize = size; best = n.innerText.trim().slice(0, 60); }
    }
    return { path, heading: best };
  } catch { return { path: '?', heading: null }; }
}

function pollScreen() {
  if (!S.recording) return;
  const s = currentScreen();
  const key = s.path + '::' + s.heading;
  if (key !== S.lastScreen) {
    S.lastScreen = key;
    log('screen', { path: s.path, heading: s.heading }, `${s.heading || '(no heading)'}   ${s.path}`);
  }
}

// ── gaze ─────────────────────────────────────────────────────────────────────
function flushFixation() {
  const f = S.fixation;
  S.fixation = null;
  if (!f) return;
  const dur = f.end - f.start;
  if (dur < 200) return; // saccade, not a look

  log('gaze', {
    dwellMs: dur, target: f.desc, screen: S.lastScreen,
    x: Math.round(f.x / f.n), y: Math.round(f.y / f.n),
  }, `${(dur / 1000).toFixed(1)}s on ${describeShort(f.desc)}`);
  bump('gaze');
}

function onGaze(data) {
  if (!data || !S.recording) return;

  const rect = frame.getBoundingClientRect();
  const x = data.x - rect.left;
  const y = data.y - rect.top;

  if ($('showDot').checked) {
    const d = $('gazeDot');
    d.style.display = 'block';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
  }

  let desc = null;
  const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  if (inside) {
    try { desc = describe(frame.contentDocument.elementFromPoint(x, y)); } catch {}
  }

  // outline what's being looked at — makes calibration quality obvious
  const h = $('hilite');
  if (desc && $('showDot').checked) {
    h.style.display = 'block';
    h.style.left = desc.rect.x + 'px'; h.style.top = desc.rect.y + 'px';
    h.style.width = desc.rect.w + 'px'; h.style.height = desc.rect.h + 'px';
  } else h.style.display = 'none';

  const key = targetKey(desc);
  const t = now();
  if (S.fixation && S.fixation.key === key) {
    S.fixation.end = t; S.fixation.x += x; S.fixation.y += y; S.fixation.n++;
  } else {
    flushFixation();
    S.fixation = { key, desc, start: t, end: t, x, y, n: 1 };
  }
}

// ── calibration ──────────────────────────────────────────────────────────────
const CAL_POINTS = [[10,10],[50,10],[90,10],[10,50],[50,50],[90,50],[10,90],[50,90],[90,90]];
const CLICKS_NEEDED = 5;

function calibrate() {
  return new Promise((resolve) => {
    const pane = $('calib');
    pane.style.display = 'block';
    pane.querySelectorAll('.cdot').forEach((d) => d.remove());

    let remaining = CAL_POINTS.length;
    const update = () => { $('calibCount').textContent = `${CAL_POINTS.length - remaining} / ${CAL_POINTS.length} points done`; };
    update();

    const finish = () => { pane.style.display = 'none'; resolve(true); };
    $('btnSkipCalib').onclick = () => { pane.style.display = 'none'; resolve(false); };

    CAL_POINTS.forEach(([px, py], i) => {
      const dot = document.createElement('div');
      dot.className = 'cdot';
      dot.style.left = px + '%';
      dot.style.top = py + '%';
      let hits = 0;
      dot.textContent = CLICKS_NEEDED;
      dot.onclick = () => {
        hits++;
        dot.textContent = Math.max(CLICKS_NEEDED - hits, 0);
        dot.style.opacity = 0.35 + 0.65 * (hits / CLICKS_NEEDED);
        if (hits >= CLICKS_NEEDED) {
          dot.classList.add('done'); dot.textContent = '✓'; dot.onclick = null;
          remaining--; update();
          if (remaining === 0) setTimeout(finish, 400);
        }
      };
      pane.appendChild(dot);
    });
  });
}

// ── speech ───────────────────────────────────────────────────────────────────
function startSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { log('note', {}, 'no live transcription in this browser — audio still recorded'); return; }

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (!r.isFinal) continue;
      const text = r[0].transcript.trim();
      if (!text) continue;
      const u = { t: now(), text, confidence: r[0].confidence, screen: S.lastScreen };
      S.utterances.push(u);
      S.events.push({ t: u.t, kind: 'say', text });
      bump('say');

      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span class="t">${(u.t / 1000).toFixed(1)}s</span><span class="v"></span>`;
      row.querySelector('.v').textContent = text;
      $('says').appendChild(row);
      $('says').scrollTop = $('says').scrollHeight;
    }
  };
  // the API stops itself after a pause; keep it alive for the whole session
  rec.onend = () => { if (S.recording) { try { rec.start(); } catch {} } };
  rec.onerror = (e) => { if (e.error !== 'no-speech') log('note', {}, 'speech: ' + e.error); };

  try { rec.start(); S.recognition = rec; } catch (e) { log('note', {}, 'speech failed: ' + e.message); }
}

async function startAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size) S.audioChunks.push(e.data); };
    mr.start(1000);
    S.mediaRecorder = mr;
  } catch (e) { log('note', {}, 'mic unavailable: ' + e.message); }
}

// ── interactions inside the app ──────────────────────────────────────────────
let wiredDoc = null;
function wireFrame() {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc) return;
  // wireFrame runs both on iframe load and on Start; without this guard every
  // listener binds twice and the timeline shows each tap two or three times.
  if (wiredDoc === doc) return;
  wiredDoc = doc;

  doc.addEventListener('click', (e) => {
    if (!S.recording) return;
    const d = describe(e.target);
    log('tap', { target: d, x: e.clientX, y: e.clientY }, describeShort(d));
    bump('tap');
    // a tap that changes nothing is the classic dead control — check shortly after
    const before = doc.body.innerText.length;
    setTimeout(() => {
      if (!S.recording) return;
      if (Math.abs(doc.body.innerText.length - before) < 3) {
        log('note', { deadTap: true, target: d }, `nothing changed after tapping ${describeShort(d)}`);
      }
    }, 900);
  }, true);

  let scrollTimer = null;
  doc.addEventListener('scroll', () => {
    if (!S.recording) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => log('scroll', {}, 'scrolled'), 250);
  }, true);

  // Focus is its own kind, not a tap. A click on a field fires both, and
  // counting them together doubles the tap tally and invents rage-taps.
  doc.addEventListener('focusin', (e) => {
    if (!S.recording) return;
    const d = describe(e.target);
    log('focus', { target: d }, 'typing into ' + describeShort(d)); // value never captured
  }, true);
}
frame.addEventListener('load', wireFrame);

// double-tap Space to mark a moment
let lastSpace = 0;
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !S.recording) return;
  const t = Date.now();
  if (t - lastSpace < 600) {
    log('note', { manual: true }, '⚑ marked by hand');
    lastSpace = 0;
  } else lastSpace = t;
});

// ── run control ──────────────────────────────────────────────────────────────
$('btnStart').onclick = async () => {
  $('btnStart').disabled = true;

  if ($('useGaze').checked && SECURE) {
    $('statusPill').textContent = 'calibrating';
    try {
      await webgazer.setRegression('ridge').setGazeListener(onGaze).begin();
      webgazer.showVideoPreview(true).showPredictionPoints(false);
      S.gazeOn = await calibrate();
      S.calibrated = S.gazeOn;
      webgazer.showVideoPreview(false);
    } catch (e) {
      alert('Eye tracking could not start: ' + e.message + '\nRecording without it.');
      S.gazeOn = false;
    }
  }

  await fetch('/session/start', { method: 'POST' }).catch(() => {});

  S.t0 = performance.now();
  S.recording = true;
  $('statusPill').textContent = 'recording';
  $('statusPill').className = 'pill live';
  $('btnStop').disabled = false;
  $('btnRecal').disabled = !S.gazeOn;

  wireFrame();
  if ($('useVoice').checked && SECURE) { startSpeech(); await startAudio(); }

  log('note', {
    goal: $('goal').value, persona: $('persona').value,
    gaze: S.gazeOn, voice: $('useVoice').checked,
  }, `started — ${$('goal').value || 'no goal set'}`);

  setInterval(pollScreen, 300);
  setInterval(() => {
    if (!S.recording) return;
    const s = Math.floor((performance.now() - S.t0) / 1000);
    $('clock').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
};

$('btnRecal').onclick = async () => { await calibrate(); };

$('btnStop').onclick = async () => {
  $('btnStop').disabled = true;
  $('statusPill').textContent = 'saving';
  $('statusPill').className = 'pill';
  S.recording = false;
  flushFixation();

  if (S.recognition) { try { S.recognition.stop(); } catch {} }
  if (S.gazeOn) { try { webgazer.end(); } catch {} }

  let audioBase64 = null;
  if (S.mediaRecorder && S.mediaRecorder.state !== 'inactive') {
    audioBase64 = await new Promise((resolve) => {
      S.mediaRecorder.onstop = async () => {
        const blob = new Blob(S.audioChunks, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        resolve(btoa(bin));
      };
      S.mediaRecorder.stop();
    });
  }

  const payload = {
    startedAt: new Date().toISOString(),
    durationMs: now(),
    goal: $('goal').value,
    persona: $('persona').value,
    gazeEnabled: S.gazeOn,
    viewport: { w: 390, h: 844 },
    events: S.events,
    utterances: S.utterances,
    audioBase64,
  };

  const res = await fetch('/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json()).catch((e) => ({ error: e.message }));

  if (res.dir) {
    $('statusPill').textContent = 'saved';
    $('statusPill').className = 'pill ok';
    alert('Saved.\n\n' + res.dir + '\n\nDiagnose it with:\npython3 tools/walkthrough/diagnose.py ' + res.dir);
  } else {
    alert('Could not save: ' + (res.error || 'unknown'));
  }
};
