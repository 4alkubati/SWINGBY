// toon.mjs — the cartoon layer for Swingbyy Shorts v1 (FORMAT.md §4).
//
// Four primitives, drawn as vectors on the SAME Skia canvas as the product
// footage. That is the whole design decision: an overlay rendered separately
// (manim, a PNG sequence, a second compositor) would not inherit v5's
// supersampled shutter, so the cartoons would strobe while the UI behind them
// did not — which reads worse than having no cartoons at all.
//
// Everything here takes a normalised progress `p` (0..1 through its own beat)
// and draws one instant. Nothing holds state, so subframe sampling works by
// calling the same function at p + a fraction of a frame.
//
// WHY THE CAST IS DRAWN AND NOT IMPORTED
// --------------------------------------
// Imported character art is a licence we would have to keep track of and a
// binary we would have to ship to every render host. Primitives — circle,
// capsule, dot, arc — cost nothing, scale to any resolution, and can be
// recoloured to the brand token without an asset pipeline.
//
// BOUNCE IS ALLOWED HERE AND NOWHERE ELSE (FORMAT.md §4). The UI motion stays
// on MD3 curves at zero overshoot because Swingbyy is under a claims freeze and
// bouncy product motion reads as a promise. A cartoon bouncing is legibly a
// joke. A price card bouncing is legibly a lie.

export const ACCENT = '#8878f9'
export const ACCENT_DEEP = '#6d55f6'
export const INK = '#f4f6fa'
export const DIM = '#9aa2b4'
export const SKIN = '#f2c9a0'
export const HAIR = '#2b2233'

const TAU = Math.PI * 2

// --- shared helpers --------------------------------------------------------

export function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  c.beginPath(); c.moveTo(x + rr, y)
  c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr)
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath()
}

/** Damped bounce, used only by the cartoon layer. Settles at 1. */
export function bounce(p, cycles = 2, damp = 5.5) {
  if (p <= 0) return 0
  if (p >= 1) return 1
  return 1 - Math.cos(p * Math.PI * cycles) * Math.exp(-damp * p)
}

/** Squash-and-stretch: volume-preserving, so an entrance reads as weight. */
function squash(c, s) {
  c.scale(1 / s, s)
}

// --- 1. ARROW --------------------------------------------------------------
// Points at one UI element. Enters on the caller's ease, then bounces along
// its OWN axis — a bounce perpendicular to the direction it points would read
// as wobble rather than as insistence.
//
// `from` and `to` are absolute canvas px. The arrow is drawn as a quadratic
// with the control point offset perpendicular to the chord, which is what
// makes it read as hand-drawn rather than as a UI affordance.
export function drawArrow(c, { from, to, curve = 0.28, width = 9, color = ACCENT }, p, ease) {
  const e = ease(Math.min(1, p / 0.42))
  if (e <= 0) return
  const [x0, y0] = from, [x1, y1] = to
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len

  // Bounce travels along the pointing axis, toward the target and back.
  const b = p > 0.42 ? Math.sin((p - 0.42) / 0.58 * Math.PI * 2) * Math.exp(-2.2 * (p - 0.42)) : 0
  const push = b * 16

  // Grow the arrow from its tail so it reads as being drawn, not as appearing.
  const tipX = x0 + dx * e + ux * push, tipY = y0 + dy * e + uy * push
  const cxp = (x0 + tipX) / 2 - uy * len * curve
  const cyp = (y0 + tipY) / 2 + ux * len * curve

  c.save()
  c.globalAlpha = Math.min(1, p / 0.18)
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cxp, cyp, tipX, tipY); c.stroke()

  // Head angle comes from the curve's tangent at t=1, not from the chord —
  // on a curved arrow those differ by enough to look broken.
  const ang = Math.atan2(tipY - cyp, tipX - cxp)
  const hl = width * 4.2
  c.fillStyle = color
  c.beginPath()
  c.moveTo(tipX, tipY)
  c.lineTo(tipX - hl * Math.cos(ang - 0.42), tipY - hl * Math.sin(ang - 0.42))
  c.lineTo(tipX - hl * 0.62 * Math.cos(ang), tipY - hl * 0.62 * Math.sin(ang))
  c.lineTo(tipX - hl * Math.cos(ang + 0.42), tipY - hl * Math.sin(ang + 0.42))
  c.closePath(); c.fill()
  c.restore()
}

// --- 2. POP ----------------------------------------------------------------
// Marks the instant something lands. Short and additive — 380 ms at 60 fps is
// 23 frames, which is long enough to register and too short to be decoration.
export function drawPop(c, { at, r = 96, rays = 8, color = ACCENT }, p, ease, accel) {
  if (p <= 0 || p >= 1) return
  const [cx, cy] = at
  const e = ease(p), a = 1 - accel(p)
  c.save()
  c.globalAlpha = a
  c.strokeStyle = color; c.lineWidth = 8; c.lineCap = 'round'
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * TAU - Math.PI / 2
    const r0 = r * 0.36 * e, r1 = r * (0.62 + 0.5 * e)
    c.beginPath()
    c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0)
    c.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
    c.stroke()
  }
  // Three offset dots — an even ring reads as a loading spinner.
  c.fillStyle = color
  for (const [ax, ar] of [[0.7, 1.28], [2.4, 1.12], [4.3, 1.35]]) {
    c.globalAlpha = a * 0.85
    c.beginPath()
    c.arc(cx + Math.cos(ax) * r * ar * e, cy + Math.sin(ax) * r * ar * e, 7, 0, TAU)
    c.fill()
  }
  c.restore()
}

// --- 3. BUBBLE -------------------------------------------------------------
// Tail-anchored speech. Types in at ~34 ms/char, which is fast enough that the
// eye reads it as speech rather than as a terminal.
//
// The box is sized to the FULL string and held constant while the text types.
// Growing the box with the text makes the layout jump on every character and
// is the single most common way a speech bubble looks amateur.
export function drawBubble(c, { at, text, tail = 'bl', maxW = 620, font = '600 46px Grotesk', pad = 34 }, p, ease) {
  const e = ease(Math.min(1, p / 0.3))
  if (e <= 0) return
  c.save()
  c.font = font

  const words = String(text).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (c.measureText(t).width <= maxW - pad * 2) cur = t
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)

  const lh = 58
  const bw = Math.max(...lines.map(l => c.measureText(l).width)) + pad * 2
  const bh = lines.length * lh + pad * 2 - 12
  const [ax, ay] = at
  // `at` is the TAIL tip. The box hangs off it in the named direction.
  const bx = tail.includes('l') ? ax + 26 : ax - bw - 26
  const by = tail.includes('b') ? ay - bh - 30 : ay + 30

  c.translate(bx + bw / 2, by + bh / 2)
  c.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e)
  c.translate(-(bx + bw / 2), -(by + bh / 2))
  c.globalAlpha = e

  c.fillStyle = 'rgba(244,246,250,0.97)'
  roundRect(c, bx, by, bw, bh, 30); c.fill()
  // Tail as a triangle from the nearest box corner to the anchor.
  const tx = tail.includes('l') ? bx + 34 : bx + bw - 34
  const ty = tail.includes('b') ? by + bh : by
  c.beginPath()
  c.moveTo(tx - 20, ty); c.lineTo(tx + 20, ty); c.lineTo(ax, ay); c.closePath(); c.fill()

  // Type-on. `p` is beat progress, so chars-per-second is derived from the
  // caller's beat length rather than hard-coded to a frame count.
  const total = lines.join(' ').length
  const shown = Math.ceil(total * Math.min(1, Math.max(0, (p - 0.12)) / 0.5))
  let budget = shown
  c.fillStyle = '#14161c'
  c.textBaseline = 'alphabetic'
  let y = by + pad + 40
  for (const line of lines) {
    const take = Math.max(0, Math.min(line.length, budget))
    if (take > 0) c.fillText(line.slice(0, take), bx + pad, y)
    budget -= line.length + 1
    y += lh
  }
  c.restore()
}

// --- 4. CHAR ---------------------------------------------------------------
// Two characters, no more. NOOR has the problem; PIP is the phone and never
// speaks a claim, only reacts.
//
// Idle is a 2-frame bob at 6 fps rather than a smooth sine — stepped animation
// is what makes a drawing read as drawn. A smoothly floating character reads
// as a PNG on a tween, which is exactly the look we are avoiding.

const POSES = {
  slump: { tilt: 0.16, brow: -1, mouth: -0.5, armL: 2.4, armR: 0.8 },
  shock: { tilt: -0.05, brow: 1, mouth: 0.0, armL: 2.9, armR: 0.3 },
  grin: { tilt: -0.08, brow: 0.4, mouth: 1.0, armL: 2.2, armR: 1.1 },
  point: { tilt: 0.02, brow: 0.6, mouth: 0.4, armL: 2.3, armR: -0.5 },
}

export function drawChar(c, { who = 'noor', pose = 'slump', at, scale = 1, flip = false }, p, ease) {
  const P = POSES[pose] || POSES.slump
  const [x, y] = at
  // Entrance: overshoot-free rise + a squash that resolves. 0.26 of the beat.
  const e = ease(Math.min(1, p / 0.26))
  if (e <= 0) return
  const sq = 1 + 0.18 * (1 - e)             // wide-and-short, resolving to 1
  const bob = Math.floor(p * 6 * 2) % 2 === 0 ? 0 : 5   // stepped, 6 fps

  c.save()
  c.translate(x, y + bob + 70 * (1 - e))
  c.globalAlpha = e
  c.scale(flip ? -scale : scale, scale)
  squash(c, sq)

  if (who === 'pip') { drawPip(c, P, p); c.restore(); return }

  // NOOR ---------------------------------------------------------------
  // body: capsule
  c.fillStyle = ACCENT_DEEP
  roundRect(c, -62, 10, 124, 158, 54); c.fill()

  // arms: two arcs whose end angle is the pose
  c.strokeStyle = ACCENT_DEEP; c.lineWidth = 26; c.lineCap = 'round'
  for (const [sx, ang] of [[-1, P.armL], [1, P.armR]]) {
    c.beginPath()
    c.moveTo(sx * 54, 46)
    c.lineTo(sx * 54 + Math.cos(ang) * 62 * sx * -1, 46 + Math.sin(ang) * 62)
    c.stroke()
  }

  c.rotate(P.tilt)
  // head
  c.fillStyle = SKIN
  c.beginPath(); c.arc(0, -66, 76, 0, TAU); c.fill()
  // hair: a cap arc, drawn as a filled half-disc clipped by the skull
  c.fillStyle = HAIR
  c.beginPath(); c.arc(0, -66, 76, Math.PI * 1.06, Math.PI * 1.94); c.fill()

  // eyes — dots, not ellipses. Ellipse eyes read as "3D asset", dots read as ink.
  c.fillStyle = '#14161c'
  const blink = Math.floor(p * 6) % 11 === 4 ? 0.15 : 1
  for (const ex of [-26, 26]) {
    c.beginPath(); c.ellipse(ex, -62, 8, 9 * blink, 0, 0, TAU); c.fill()
  }
  // brows carry the whole expression
  c.strokeStyle = '#14161c'; c.lineWidth = 6; c.lineCap = 'round'
  for (const bx of [-26, 26]) {
    c.beginPath()
    c.moveTo(bx - 15, -88 - P.brow * 4 * Math.sign(bx || 1))
    c.lineTo(bx + 15, -88 + P.brow * 7)
    c.stroke()
  }
  // mouth: one arc, curvature = mood
  c.lineWidth = 7
  c.beginPath()
  if (Math.abs(P.mouth) < 0.12) { c.moveTo(-20, -28); c.lineTo(20, -28) }
  else c.arc(0, -28 - P.mouth * 16, 24, P.mouth > 0 ? 0.2 : Math.PI + 0.2, P.mouth > 0 ? Math.PI - 0.2 : TAU - 0.2)
  c.stroke()

  c.restore()
}

function drawPip(c, P, p) {
  // The phone as a character. Screen glow pulses on the same stepped clock as
  // NOOR's bob so the two read as living in one drawing.
  const lit = Math.floor(p * 6 * 2) % 2 === 0 ? 0.34 : 0.22
  c.fillStyle = '#14161c'
  roundRect(c, -68, -118, 136, 236, 30); c.fill()
  c.fillStyle = `rgba(136,120,249,${lit})`
  roundRect(c, -56, -104, 112, 208, 20); c.fill()
  c.fillStyle = INK
  for (const ex of [-24, 24]) { c.beginPath(); c.arc(ex, -34, 11, 0, TAU); c.fill() }
  c.strokeStyle = INK; c.lineWidth = 7; c.lineCap = 'round'
  c.beginPath()
  c.arc(0, 6, 26, P.mouth > 0 ? 0.25 : Math.PI + 0.25, P.mouth > 0 ? Math.PI - 0.25 : TAU - 0.25)
  c.stroke()
}
