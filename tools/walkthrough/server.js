#!/usr/bin/env node
/**
 * SwingBy walkthrough harness — server.
 *
 * Serves three things from ONE origin so the recorder can reach into the app:
 *   /            the recorder UI (harness.html)
 *   /app/*       the Expo web export of the mobile app
 *   /api/*       reverse proxy to the backend (strips /api)
 *
 * Same-origin matters twice over:
 *   1. the recorder needs iframe.contentDocument to know WHAT was looked at,
 *      not just where — cross-origin would reduce gaze to meaningless x/y.
 *   2. the app's XHRs go to /api on this origin, so the backend CORS allowlist
 *      (localhost:5173, localhost:3000 only) never comes into play.
 *
 * The proxy doubles as a free network log: every call the app makes during a
 * walkthrough is timed and recorded, so "nothing happened when I tapped it"
 * can be answered with an actual status code.
 *
 * Zero npm dependencies — node stdlib only.
 *
 * Usage:
 *   node tools/walkthrough/server.js --app <expo-web-export-dir> [options]
 *
 * Options:
 *   --app   <dir>   Expo web export to serve      (required)
 *   --api   <url>   backend base URL              (default https://swingbyy-api.onrender.com)
 *   --port  <n>     listen port                   (default 8080)
 *   --out   <dir>   where sessions are written    (default tools/walkthrough/sessions)
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ── args ─────────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const HERE = __dirname;
const APP_DIR = arg('app', null);
const API_BASE = arg('api', 'https://swingbyy-api.onrender.com').replace(/\/$/, '');
const PORT = parseInt(arg('port', '8080'), 10);
const OUT_DIR = arg('out', path.join(HERE, 'sessions'));
const VENDOR_DIR = path.join(HERE, 'vendor');

if (!APP_DIR) {
  console.error('error: --app <dir> is required (an Expo web export).');
  console.error('       build one with: tools/walkthrough/build-app.sh');
  process.exit(1);
}
if (!fs.existsSync(path.join(APP_DIR, 'index.html'))) {
  console.error(`error: ${APP_DIR} has no index.html — is it an Expo web export?`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(VENDOR_DIR, { recursive: true });

// ── WebGazer is fetched at runtime, never vendored ───────────────────────────
// It is GPLv3 (LGPLv3 for companies valued under $1M). Keeping it out of the
// repo keeps that licence off SwingBy's tree entirely — this is a dev-only
// tool and none of it ships in the app or on the website.
const WEBGAZER_URL = 'https://cdn.jsdelivr.net/npm/webgazer@3.3.0/dist/webgazer.js';
const WEBGAZER_FILE = path.join(VENDOR_DIR, 'webgazer.js');

function ensureWebgazer() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(WEBGAZER_FILE) && fs.statSync(WEBGAZER_FILE).size > 100000) {
      return resolve('cached');
    }
    console.log('· fetching webgazer.js (one time, ~1.7 MB)…');
    https
      .get(WEBGAZER_URL, (res) => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        const out = fs.createWriteStream(WEBGAZER_FILE);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve('downloaded')));
      })
      .on('error', reject);
  });
}

// ── the network log the proxy fills in ───────────────────────────────────────
let netLog = [];
let netT0 = Date.now();

// Top-level paths inside the app build that must resolve even though the app
// is mounted at /app (Expo hardcodes them absolute).
const APP_ROOTS = ['/_expo', '/assets', '/favicon.ico', '/metadata.json'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.webm': 'audio/webm', '.map': 'application/json',
};

function serveFile(res, file, { spaFallback = null } = {}) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (spaFallback) return serveFile(res, spaFallback);
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('404');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  });
}

// Block traversal: resolve and confirm the result is still inside root.
function safeJoin(root, urlPath) {
  const p = path.normalize(path.join(root, decodeURIComponent(urlPath)));
  return p.startsWith(path.resolve(root)) ? p : null;
}

// ── proxy ────────────────────────────────────────────────────────────────────
function proxy(req, res, targetPath) {
  const target = new URL(API_BASE + targetPath);
  const mod = target.protocol === 'https:' ? https : http;
  const started = Date.now();

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  delete headers['accept-encoding']; // keep bodies readable for logging

  const preq = mod.request(
    { protocol: target.protocol, hostname: target.hostname, port: target.port,
      path: target.pathname + target.search, method: req.method, headers },
    (pres) => {
      netLog.push({
        t: started,
        ms: Date.now() - started,
        method: req.method,
        path: targetPath,
        status: pres.statusCode,
      });
      res.writeHead(pres.statusCode, {
        ...pres.headers,
        'access-control-allow-origin': '*',
      });
      pres.pipe(res);
    }
  );

  preq.on('error', (e) => {
    netLog.push({ t: started, ms: Date.now() - started, method: req.method, path: targetPath, status: 0, error: e.message });
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ detail: 'proxy error: ' + e.message }));
  });

  req.pipe(preq);
}

function readBody(req, limitBytes = 200 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limitBytes) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── routes ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (p.startsWith('/api/')) return proxy(req, res, p.slice(4) + u.search);

  if (p === '/' || p === '/index.html') return serveFile(res, path.join(HERE, 'harness.html'));
  if (p === '/harness.js') return serveFile(res, path.join(HERE, 'harness.js'));
  if (p === '/vendor/webgazer.js') return serveFile(res, WEBGAZER_FILE);

  // Start of a run: clear the network log and stamp t0.
  // The browser times events with performance.now() and the proxy stamps calls
  // with Date.now() — different clocks, and on different machines if the
  // recorder is driven from a laptop. Anchoring both to a server-side t0 taken
  // at Start is what lets API calls line up with taps on one timeline.
  if (p === '/session/start' && req.method === 'POST') {
    netLog = [];
    netT0 = Date.now();
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, t0: netT0 }));
  }

  // the app under test
  if (p.startsWith('/app')) {
    const rest = p.slice(4) || '/';
    const file = safeJoin(APP_DIR, rest === '/' ? '/index.html' : rest);
    if (!file) { res.writeHead(400); return res.end('bad path'); }
    return serveFile(res, file, { spaFallback: path.join(APP_DIR, 'index.html') });
  }

  // Expo emits absolute asset URLs ("/_expo/static/…"), which escape the /app
  // mount when the app runs in an iframe. Serve those roots from the build too.
  if (APP_ROOTS.some((r) => p === r || p.startsWith(r + '/'))) {
    const file = safeJoin(APP_DIR, p);
    if (!file) { res.writeHead(400); return res.end('bad path'); }
    return serveFile(res, file);
  }

  // end of a run: persist everything
  if (p === '/session' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await readBody(req)).toString('utf8')); }
    catch (e) { res.writeHead(400); return res.end('bad json'); }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dir = path.join(OUT_DIR, stamp);
    fs.mkdirSync(dir, { recursive: true });

    if (body.audioBase64) {
      fs.writeFileSync(path.join(dir, 'audio.webm'), Buffer.from(body.audioBase64, 'base64'));
      delete body.audioBase64;
    }
    body.network = netLog;
    body.networkT0 = netT0;
    body.apiBase = API_BASE;
    fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(body, null, 2));

    console.log(`\n✓ session saved → ${dir}`);
    console.log(`  ${(body.events || []).length} events · ${(body.utterances || []).length} utterances · ${netLog.length} api calls`);
    console.log(`  diagnose with:  python3 tools/walkthrough/diagnose.py ${dir}\n`);

    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, dir }));
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('404');
});

ensureWebgazer()
  .then((how) => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  SwingBy walkthrough harness`);
      console.log(`  ───────────────────────────`);
      console.log(`  recorder   http://localhost:${PORT}/`);
      console.log(`  app build  ${APP_DIR}`);
      console.log(`  api proxy  /api/*  →  ${API_BASE}`);
      console.log(`  sessions   ${OUT_DIR}`);
      console.log(`  webgazer   ${how}\n`);
      console.log(`  NOTE: the camera and microphone need a secure context.`);
      console.log(`  Reaching this over the LAN by IP will NOT work — see the README.\n`);
    });
  })
  .catch((e) => {
    console.error('could not fetch webgazer.js:', e.message);
    console.error('download it manually to', WEBGAZER_FILE);
    process.exit(1);
  });
