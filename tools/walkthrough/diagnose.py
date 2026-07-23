#!/usr/bin/env python3
"""
Turn a recorded walkthrough into a diagnosis.

    python3 tools/walkthrough/diagnose.py tools/walkthrough/sessions/<stamp>

Writes two files next to session.json:

    report.md     the readable version — merged timeline plus what looks wrong
    findings.json the same signals, structured, for an agent to map onto code

The split matters. This script never guesses at causes; it only says what
happened and where it smells. Naming the actual broken function is a job for
whoever reads findings.json with the repo open — see the README.

Signals it looks for
--------------------
  stare          long look at something, then no action        → unclear or unreadable
  dead-tap       tapped, nothing on screen changed             → dead control
  rage-tap       same target hit 3+ times in a few seconds     → it isn't responding
  backtrack      screen A → B → back to A quickly              → wrong turn, bad label
  unseen         a control was on screen and never looked at   → invisible in practice
  api-error      backend returned 4xx/5xx or failed            → hard breakage
  api-slow       call took over 2s                             → feels broken even when it works
  silent-fail    api error with no visible change              → the worst kind: user told nothing
  said-negative  frustration or confusion in the narration     → the user's own verdict
  marked         double-tapped space                           → flagged by hand
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict, Counter

# Phrases that mean the walkthrough went wrong. Deliberately plain — this is a
# keyword pass, not sentiment analysis, and it is only ever used to RANK
# moments for a human to look at.
NEGATIVE = [
    "confus", "where is", "where's", "why is", "why does", "why can't", "can't find",
    "cant find", "i don't know", "i dont know", "not sure", "weird", "strange",
    "broken", "doesn't work", "doesnt work", "not working", "nothing happen",
    "nothing happened", "stuck", "expected", "thought it would", "supposed to",
    "ugly", "too small", "hard to read", "can't read", "cant read", "empty",
    "blank", "slow", "loading", "wait", "annoying", "frustrat", "hate", "wrong",
    "missing", "should be", "makes no sense", "what is this", "what's this",
    "huh", "hmm", "oh no", "that's odd", "thats odd",
]

STARE_MS = 1500          # a look this long with no follow-up action reads as hesitation
ACTION_WINDOW_MS = 3000  # how long after a stare we still count a tap as "acted on it"
RAGE_WINDOW_MS = 5000
RAGE_COUNT = 3
BACKTRACK_MS = 15000
SLOW_API_MS = 2000
SPEECH_WINDOW_MS = 6000  # how far to reach for narration explaining a moment


def load(session_dir: Path):
    f = session_dir / "session.json"
    if not f.exists():
        sys.exit(f"error: no session.json in {session_dir}")
    return json.loads(f.read_text())


def target_name(ev) -> str:
    t = ev.get("target")
    if not t:
        return "(outside the phone)"
    c = t.get("control") or {}
    if c.get("label"):
        return f"[{c.get('role', '?')}] {c['label']}"
    if t.get("text"):
        return f'"{t["text"]}"'
    r = t.get("rect") or {}
    if r.get("w"):
        # An unlabelled box. Where it sits is the only handle we have on it,
        # and it is usually the interesting part — unlabelled things that get
        # looked at are exactly what needs a label.
        return f"unlabelled {r['w']}×{r['h']} at y={r['y']}"
    return f"<{t.get('tag', '?')}>"


def fmt_t(ms) -> str:
    s = ms / 1000
    return f"{int(s // 60):02d}:{s % 60:04.1f}"


def near_speech(utterances, t, window=SPEECH_WINDOW_MS):
    """Narration close in time to a moment — the user explaining themselves."""
    return [u for u in utterances if abs(u["t"] - t) <= window]


def analyse(sess):
    events = sorted(sess.get("events", []), key=lambda e: e["t"])
    utts = sess.get("utterances", [])
    net = sess.get("network", [])
    # The server stamps networkT0 when recording starts, on its own clock, so
    # API calls and taps share one timeline. Falling back to the first call's
    # timestamp would pin that call to 0:00 wherever it really happened.
    t0_wall = sess.get("networkT0") or min((n["t"] for n in net), default=None)

    taps = [e for e in events if e["kind"] == "tap"]
    gazes = [e for e in events if e["kind"] == "gaze"]
    screens = [e for e in events if e["kind"] == "screen"]
    notes = [e for e in events if e["kind"] == "note"]

    findings = []

    def add(kind, severity, t, summary, **extra):
        f = {
            "kind": kind, "severity": severity, "t": t, "at": fmt_t(t),
            "summary": summary,
            "said": [u["text"] for u in near_speech(utts, t)],
        }
        f.update(extra)
        findings.append(f)

    # ── stares: looked hard at something, then did nothing ───────────────────
    for g in gazes:
        if g.get("dwellMs", 0) < STARE_MS:
            continue
        acted = any(0 <= tp["t"] - g["t"] <= ACTION_WINDOW_MS for tp in taps)
        if acted:
            continue
        add("stare", "medium", g["t"],
            f'stared {g["dwellMs"]/1000:.1f}s at {target_name(g)} without acting',
            target=target_name(g), dwellMs=g["dwellMs"], screen=g.get("screen"))

    # ── dead taps (flagged live by the recorder) ─────────────────────────────
    for n in notes:
        if n.get("deadTap"):
            add("dead-tap", "high", n["t"],
                f"tapped {target_name(n)} and nothing on screen changed",
                target=target_name(n))
        if n.get("manual"):
            add("marked", "high", n["t"], "flagged by hand during the walkthrough")

    # ── rage taps ────────────────────────────────────────────────────────────
    by_target = defaultdict(list)
    for tp in taps:
        by_target[target_name(tp)].append(tp["t"])
    for name, times in by_target.items():
        times.sort()
        for i in range(len(times)):
            burst = [t for t in times[i:] if t - times[i] <= RAGE_WINDOW_MS]
            if len(burst) >= RAGE_COUNT:
                add("rage-tap", "high", times[i],
                    f"hit {name} {len(burst)}× in {(burst[-1]-burst[0])/1000:.1f}s",
                    target=name, count=len(burst))
                break

    # ── backtracking ─────────────────────────────────────────────────────────
    for i in range(len(screens) - 2):
        a, b, c = screens[i], screens[i + 1], screens[i + 2]
        same = (a.get("heading") == c.get("heading") and a.get("path") == c.get("path"))
        if same and a.get("heading") != b.get("heading") and c["t"] - a["t"] <= BACKTRACK_MS:
            add("backtrack", "medium", b["t"],
                f'went to "{b.get("heading")}" then straight back to "{a.get("heading")}"',
                left=a.get("heading"), visited=b.get("heading"))

    # ── controls that were on screen but never looked at ─────────────────────
    if sess.get("gazeEnabled"):
        looked = {g.get("target", {}).get("control", {}).get("label")
                  for g in gazes if (g.get("target") or {}).get("control")}
        tapped = {target_name(t) for t in taps}
        looked.discard(None)
        # only meaningful for things the user DID eventually tap: they had to
        # hunt for it. A control never looked at and never tapped may simply
        # have been off-screen, so we can't claim anything about it.
        for name in tapped:
            label = name.split("] ", 1)[-1]
            if label and label not in looked:
                add("unseen", "low", 0,
                    f"tapped {name} without the tracker ever registering a look at it",
                    target=name)

    # ── backend behaviour ────────────────────────────────────────────────────
    for n in net:
        rel = n["t"] - t0_wall if t0_wall else 0
        if n.get("status", 0) >= 400 or n.get("status") == 0:
            sev = "high" if n.get("status", 0) >= 500 or n.get("status") == 0 else "medium"
            add("api-error", sev, rel,
                f'{n["method"]} {n["path"]} → {n.get("status") or "failed"} ({n.get("error","")})'.strip(),
                path=n["path"], status=n.get("status"))
        elif n.get("ms", 0) > SLOW_API_MS:
            add("api-slow", "medium", rel,
                f'{n["method"]} {n["path"]} took {n["ms"]/1000:.1f}s',
                path=n["path"], ms=n["ms"])

    # ── what the narration itself flagged ────────────────────────────────────
    for u in utts:
        low = u["text"].lower()
        hits = [w for w in NEGATIVE if w in low]
        if hits:
            add("said-negative", "high", u["t"],
                f'said: "{u["text"]}"', matched=hits, text=u["text"])

    findings.sort(key=lambda f: ({"high": 0, "medium": 1, "low": 2}[f["severity"]], f["t"]))
    return findings, events, utts, net


def timeline(events, utts, net, t0_wall):
    """Everything on one clock — the thing that makes a walkthrough readable."""
    rows = []
    for e in events:
        if e["kind"] == "gaze":
            rows.append((e["t"], "look", f'{e["dwellMs"]/1000:.1f}s · {target_name(e)}'))
        elif e["kind"] == "tap":
            rows.append((e["t"], "tap", target_name(e)))
        elif e["kind"] == "focus":
            rows.append((e["t"], "type", target_name(e)))
        elif e["kind"] == "screen":
            rows.append((e["t"], "SCREEN", f'{e.get("heading") or "(no heading)"}  {e.get("path","")}'))
        elif e["kind"] == "note":
            rows.append((e["t"], "note", e.get("goal") and f'start — {e.get("goal")}' or "flag"))
        elif e["kind"] == "scroll":
            rows.append((e["t"], "scroll", ""))
    for u in utts:
        rows.append((u["t"], "SAID", u["text"]))
    for n in net:
        rel = n["t"] - t0_wall if t0_wall else 0
        mark = "" if 200 <= n.get("status", 0) < 400 else "  ⚠"
        rows.append((rel, "api", f'{n["method"]} {n["path"]} → {n.get("status") or "failed"} ({n.get("ms",0)}ms){mark}'))
    rows.sort(key=lambda r: r[0])
    return rows


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    d = Path(sys.argv[1])
    sess = load(d)
    findings, events, utts, net = analyse(sess)

    t0_wall = sess.get("networkT0") or min((n["t"] for n in net), default=None)
    rows = timeline(events, utts, net, t0_wall)

    counts = Counter(f["kind"] for f in findings)
    sev = Counter(f["severity"] for f in findings)

    L = []
    L.append("# Walkthrough diagnosis\n")
    L.append(f"- **Goal:** {sess.get('goal') or '(not set)'}")
    L.append(f"- **Persona:** {sess.get('persona') or '(not set)'}")
    L.append(f"- **Recorded:** {sess.get('startedAt','?')} · {sess.get('durationMs',0)/1000:.0f}s")
    L.append(f"- **Eye tracking:** {'on' if sess.get('gazeEnabled') else 'off'}")
    L.append(f"- **Backend:** {sess.get('apiBase','?')}")
    L.append(f"- **Signals:** {sev['high']} high · {sev['medium']} medium · {sev['low']} low\n")

    if not findings:
        L.append("Nothing tripped a signal. Either the run was clean or it was too short.\n")

    L.append("## What looks wrong\n")
    L.append("Ordered by severity, then by when it happened. "
             "`said:` is what was being narrated within six seconds either side.\n")
    for f in findings:
        L.append(f"### `{f['kind']}` · {f['severity']} · {f['at']}")
        L.append(f"{f['summary']}\n")
        if f.get("screen"):
            L.append(f"- screen: `{f['screen']}`")
        if f.get("said"):
            for s in f["said"]:
                L.append(f'- said: _"{s}"_')
        L.append("")

    L.append("## Timeline\n")
    L.append("```")
    for t, kind, text in rows:
        L.append(f"{fmt_t(t):>8}  {kind:<7} {text}")
    L.append("```\n")

    if counts:
        L.append("## Tally\n")
        for k, v in counts.most_common():
            L.append(f"- `{k}` × {v}")
        L.append("")

    L.append("## Next step\n")
    L.append("Hand `findings.json` and this file to Claude Code with the repo open:\n")
    L.append("```")
    L.append("Read tools/walkthrough/sessions/<stamp>/findings.json and report.md.")
    L.append("For each high-severity finding, find the component or endpoint")
    L.append("responsible in mobile/src and backend/app, and tell me what to fix.")
    L.append("Do not guess — cite file:line.")
    L.append("```")

    (d / "report.md").write_text("\n".join(L))
    (d / "findings.json").write_text(json.dumps({
        "goal": sess.get("goal"), "persona": sess.get("persona"),
        "durationMs": sess.get("durationMs"), "gazeEnabled": sess.get("gazeEnabled"),
        "apiBase": sess.get("apiBase"), "findings": findings,
    }, indent=2))

    print(f"report    {d/'report.md'}")
    print(f"findings  {d/'findings.json'}")
    print(f"\n{sev['high']} high · {sev['medium']} medium · {sev['low']} low")
    for k, v in counts.most_common():
        print(f"  {k:<14} {v}")


if __name__ == "__main__":
    main()
