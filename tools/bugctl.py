#!/usr/bin/env python3
"""bugctl — the SwingBy bug ledger.

Why this exists
---------------
Finding bugs was never the bottleneck. `inbox/SENTINEL-findings.md` is 900+ lines
of well-proven findings and roughly half of them are stale — already fixed, or
fixed-then-broken-again — and nobody can tell which half. Prose findings have no
identity, so they cannot be closed, deduped, or re-verified. Every sweep starts
from zero and rediscovers the same five money bugs.

The ledger fixes exactly that and nothing else:

  * every finding gets a permanent id (SB-0001) that survives rewording
  * every finding carries a `verify` command — the literal check that proves it
    fixed. A finding with no verify step CANNOT be marked fixed. That single
    rule is what stops "I think I did that one already"
  * every finding carries `verified_at` + the commit it was verified against, so
    staleness is a computed fact, not a guess
  * a fingerprint dedupes reruns, so scan #4 adds only what scan #3 missed

Storage is one JSON object per line in docs/bugs/ledger.jsonl — append-mostly,
diffs cleanly in git, and a merge conflict touches one bug rather than the file.

Usage
-----
    python tools/bugctl.py add --title "..." --severity blocker --area mobile \
        --file mobile/src/screens/x.js:42 --evidence "..." --verify "pytest -k x"
    python tools/bugctl.py list --status open --severity blocker
    python tools/bugctl.py show SB-0007
    python tools/bugctl.py next                  # what to fix now, ranked
    python tools/bugctl.py check "duplicate payments row on accept"
    python tools/bugctl.py verified SB-0007 --result still-broken
    python tools/bugctl.py close SB-0007 --commit HEAD
    python tools/bugctl.py stale --days 14       # findings nobody re-checked
    python tools/bugctl.py render > docs/bugs/LEDGER.md
    python tools/bugctl.py stats
    python tools/bugctl.py import findings.json  # bulk, from a scan agent
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "docs", "bugs", "ledger.jsonl")

# Ordered worst-first. Used for ranking and for `next`.
SEVERITIES = ["blocker", "broken", "sloppy", "polish"]

# open      — found, not yet re-verified against current HEAD
# confirmed — re-verified as still broken; safe to dispatch a fix
# fixed     — fix landed AND the verify step passed
# stale     — re-verification found it no longer reproduces (fixed by accident,
#             or the finding was wrong). Kept, never deleted — a stale finding
#             that comes back is the single best regression signal we have.
# wontfix   — deliberate product decision, with a reason
# dupe      — same defect as another id
STATUSES = ["open", "confirmed", "fixed", "stale", "wontfix", "dupe"]

AREAS = ["mobile", "backend", "web", "db", "design", "infra", "docs", "marketing"]


# ---------------------------------------------------------------- utilities


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def git_head() -> str:
    try:
        out = subprocess.run(
            ["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def fingerprint(title: str, files: list[str]) -> str:
    """Stable identity for a defect, resilient to rewording.

    Built from the significant words of the title plus the *file paths* of the
    evidence with line numbers stripped — line numbers drift on every edit, so
    including them would defeat the dedupe on exactly the reruns it exists for.
    """
    words = re.findall(r"[a-z0-9]+", title.lower())
    stop = {
        "the", "a", "an", "is", "are", "to", "on", "in", "of", "for", "and",
        "but", "with", "at", "it", "its", "that", "this", "when", "not", "no",
    }
    sig = sorted(w for w in words if w not in stop and len(w) > 2)
    paths = sorted({f.split(":")[0] for f in files})
    return hashlib.sha1(("|".join(sig) + "#" + "|".join(paths)).encode()).hexdigest()[:12]


def load() -> list[dict]:
    if not os.path.exists(LEDGER):
        return []
    rows = []
    with open(LEDGER, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                print(f"ledger.jsonl:{n}: corrupt row, skipped ({exc})", file=sys.stderr)
    return rows


def save(rows: list[dict]) -> None:
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    tmp = LEDGER + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        for r in sorted(rows, key=lambda r: r["id"]):
            fh.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n")
    os.replace(tmp, LEDGER)


def next_id(rows: list[dict]) -> str:
    """Sequential and never reused — a retired id must stay retired, or an old
    session's note about SB-0012 would silently attach to a different bug."""
    top = 0
    for r in rows:
        m = re.match(r"SB-(\d+)$", r.get("id", ""))
        if m:
            top = max(top, int(m.group(1)))
    return f"SB-{top + 1:04d}"


def find(rows: list[dict], bug_id: str) -> dict:
    bug_id = bug_id.upper()
    if not bug_id.startswith("SB-"):
        bug_id = f"SB-{int(bug_id):04d}"
    for r in rows:
        if r["id"] == bug_id:
            return r
    sys.exit(f"no such bug: {bug_id}")


def sev_rank(r: dict) -> int:
    try:
        return SEVERITIES.index(r.get("severity", "polish"))
    except ValueError:
        return len(SEVERITIES)


# ---------------------------------------------------------------- commands


def cmd_add(args) -> None:
    rows = load()
    files = args.file or []
    fp = fingerprint(args.title, files)

    existing = [r for r in rows if r.get("fingerprint") == fp]
    if existing and not args.force:
        e = existing[0]
        print(f"DUPLICATE of {e['id']} ({e['status']}): {e['title']}")
        print("  same fingerprint. Use --force to add anyway, or add a note:")
        print(f"    python tools/bugctl.py note {e['id']} \"seen again <date>\"")
        return

    bug = {
        "id": next_id(rows),
        "title": args.title,
        "severity": args.severity,
        "area": args.area,
        "status": "open",
        "files": files,
        "evidence": args.evidence or "",
        "repro": args.repro or "",
        "verify": args.verify,
        "fix_hint": args.fix or "",
        "screenshot": args.screenshot or "",
        "found": today(),
        "found_by": args.by,
        "found_at_commit": git_head(),
        "verified_at": None,
        "verified_commit": None,
        "closed": None,
        "closed_commit": None,
        "fingerprint": fp,
        "notes": [],
    }
    rows.append(bug)
    save(rows)
    print(f"{bug['id']}  [{bug['severity']}] {bug['title']}")


def cmd_import(args) -> None:
    """Bulk add from a JSON array — how a scan agent hands back its findings."""
    with open(args.path, encoding="utf-8") as fh:
        incoming = json.load(fh)
    if isinstance(incoming, dict):
        incoming = incoming.get("findings", [])

    rows = load()
    added, skipped = [], []
    for item in incoming:
        title = item.get("title", "").strip()
        if not title:
            continue
        files = item.get("files", [])
        fp = fingerprint(title, files)
        if any(r.get("fingerprint") == fp for r in rows):
            skipped.append(title)
            continue
        bug = {
            "id": next_id(rows),
            "title": title,
            "severity": item.get("severity", "broken"),
            "area": item.get("area", "backend"),
            "status": "open",
            "files": files,
            "evidence": item.get("evidence", ""),
            "repro": item.get("repro", ""),
            "verify": item.get("verify", ""),
            "fix_hint": item.get("fix", ""),
            "screenshot": item.get("screenshot", ""),
            "found": today(),
            "found_by": item.get("found_by", args.by),
            "found_at_commit": git_head(),
            "verified_at": None,
            "verified_commit": None,
            "closed": None,
            "closed_commit": None,
            "fingerprint": fp,
            "notes": [],
        }
        rows.append(bug)
        added.append(bug)
    save(rows)
    for b in added:
        print(f"+ {b['id']}  [{b['severity']}] {b['title']}")
    print(f"\nadded {len(added)}, skipped {len(skipped)} already-known")
    for t in skipped:
        print(f"  dup: {t}")


def cmd_list(args) -> None:
    rows = load()
    if args.status:
        rows = [r for r in rows if r["status"] in args.status]
    if args.severity:
        rows = [r for r in rows if r["severity"] in args.severity]
    if args.area:
        rows = [r for r in rows if r["area"] in args.area]
    if args.grep:
        pat = re.compile(args.grep, re.I)
        rows = [r for r in rows if pat.search(r["title"]) or pat.search(r.get("evidence", ""))]

    rows.sort(key=lambda r: (sev_rank(r), r["id"]))
    for r in rows:
        star = "!" if not r.get("verify") else " "
        print(f"{r['id']} {star} [{r['severity']:<7}] [{r['status']:<9}] {r['area']:<8} {r['title']}")
    print(f"\n{len(rows)} bug(s).   ! = no verify step, cannot be closed")


def cmd_show(args) -> None:
    r = find(load(), args.id)
    print(f"{r['id']}  [{r['severity']}] [{r['status']}]  {r['area']}")
    print(f"  {r['title']}\n")
    for label, key in [
        ("FILES", "files"),
        ("EVIDENCE", "evidence"),
        ("REPRO", "repro"),
        ("VERIFY", "verify"),
        ("FIX HINT", "fix_hint"),
        ("SCREENSHOT", "screenshot"),
    ]:
        val = r.get(key)
        if not val:
            continue
        if isinstance(val, list):
            val = "\n            ".join(val)
        print(f"  {label:<11} {val}")
    print(f"\n  found       {r['found']} by {r['found_by']} @ {r.get('found_at_commit')}")
    if r.get("verified_at"):
        print(f"  verified    {r['verified_at']} @ {r.get('verified_commit')}")
    else:
        print("  verified    NEVER — re-verify before dispatching a fix")
    if r.get("closed"):
        print(f"  closed      {r['closed']} @ {r.get('closed_commit')}")
    for n in r.get("notes", []):
        print(f"  note        {n}")


def cmd_check(args) -> None:
    """Ask 'do we already know about this?' before filing. The dedupe gate."""
    rows = load()
    words = set(re.findall(r"[a-z0-9]{3,}", args.text.lower()))
    scored = []
    for r in rows:
        hay = set(re.findall(r"[a-z0-9]{3,}", (r["title"] + " " + r.get("evidence", "")).lower()))
        overlap = len(words & hay)
        if overlap >= 2:
            scored.append((overlap, r))
    scored.sort(key=lambda t: -t[0])
    if not scored:
        print("no similar finding — this looks new.")
        return
    print("possible matches (check before filing):")
    for score, r in scored[:8]:
        print(f"  {r['id']} [{r['status']:<9}] ({score} terms) {r['title']}")


def cmd_verified(args) -> None:
    """Record a re-verification. This is the step that kills staleness."""
    rows = load()
    r = find(rows, args.id)
    r["verified_at"] = now()
    r["verified_commit"] = git_head()
    if args.result == "still-broken":
        r["status"] = "confirmed"
    elif args.result == "gone":
        r["status"] = "stale"
        r["notes"].append(f"{today()}: no longer reproduces at {r['verified_commit']} — {args.note or 'no detail'}")
    if args.note and args.result != "gone":
        r["notes"].append(f"{today()}: {args.note}")
    save(rows)
    print(f"{r['id']} -> {r['status']}  (verified @ {r['verified_commit']})")


def cmd_close(args) -> None:
    rows = load()
    r = find(rows, args.id)
    if not r.get("verify") and not args.force:
        sys.exit(
            f"{r['id']} has no verify step — it cannot be proven fixed.\n"
            f"  Add one first:  python tools/bugctl.py edit {r['id']} --verify \"<command or check>\"\n"
            f"  This guard is the whole point of the ledger; --force only if you mean it."
        )
    if not args.verified and not args.force:
        sys.exit(
            f"{r['id']}: pass --verified to confirm you ran the verify step and it passed:\n"
            f"  {r['verify']}"
        )
    r["status"] = "fixed"
    r["closed"] = today()
    r["closed_commit"] = args.commit if args.commit != "HEAD" else git_head()
    if args.note:
        r["notes"].append(f"{today()}: {args.note}")
    save(rows)
    print(f"{r['id']} -> fixed @ {r['closed_commit']}")


def cmd_edit(args) -> None:
    rows = load()
    r = find(rows, args.id)
    for key in ("title", "severity", "area", "verify", "evidence", "repro", "screenshot"):
        val = getattr(args, key, None)
        if val:
            r[key] = val
    if args.fix:
        r["fix_hint"] = args.fix
    if args.file:
        r["files"] = args.file
    if args.status:
        r["status"] = args.status
    r["fingerprint"] = fingerprint(r["title"], r.get("files", []))
    save(rows)
    print(f"{r['id']} updated")


def cmd_note(args) -> None:
    rows = load()
    r = find(rows, args.id)
    r["notes"].append(f"{today()}: {args.text}")
    save(rows)
    print(f"{r['id']} noted")


def cmd_next(args) -> None:
    """What to fix right now — ranked, and honest about what needs re-checking."""
    rows = [r for r in load() if r["status"] in ("open", "confirmed")]
    rows.sort(key=lambda r: (sev_rank(r), r["status"] != "confirmed", r["id"]))
    ready = [r for r in rows if r["status"] == "confirmed" and r.get("verify")]
    needs_check = [r for r in rows if r["status"] == "open"]
    needs_verify_step = [r for r in rows if not r.get("verify")]

    print("READY TO FIX (re-verified as still broken, has a verify step):")
    for r in ready[: args.limit]:
        print(f"  {r['id']} [{r['severity']}] {r['title']}")
        print(f"       verify: {r['verify']}")
    if not ready:
        print("  (none — run the verify pass first)")

    print(f"\nNEEDS RE-VERIFY before dispatch ({len(needs_check)}):")
    for r in needs_check[: args.limit]:
        print(f"  {r['id']} [{r['severity']}] {r['title']}")

    if needs_verify_step:
        print(f"\nUNCLOSEABLE — no verify step ({len(needs_verify_step)}):")
        for r in needs_verify_step[: args.limit]:
            print(f"  {r['id']} {r['title']}")


def cmd_stale(args) -> None:
    """Findings nobody has re-checked recently. The rot detector."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    out = []
    for r in load():
        if r["status"] not in ("open", "confirmed"):
            continue
        v = r.get("verified_at")
        if not v:
            out.append((r, "never verified"))
            continue
        try:
            when = datetime.strptime(v, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        except ValueError:
            out.append((r, "unparseable timestamp"))
            continue
        if when < cutoff:
            out.append((r, f"last checked {v[:10]}"))
    out.sort(key=lambda t: sev_rank(t[0]))
    for r, why in out:
        print(f"{r['id']} [{r['severity']:<7}] {r['title']}  ({why})")
    print(f"\n{len(out)} finding(s) unverified in the last {args.days} days.")


def cmd_stats(args) -> None:
    rows = load()
    if not rows:
        print("ledger is empty.")
        return
    by_status, by_sev, by_area = {}, {}, {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
        by_sev[r["severity"]] = by_sev.get(r["severity"], 0) + 1
        by_area[r["area"]] = by_area.get(r["area"], 0) + 1

    print(f"{len(rows)} finding(s) total   @ {git_head()}\n")
    print("BY STATUS")
    for s in STATUSES:
        if by_status.get(s):
            print(f"  {s:<10} {by_status[s]}")
    print("\nBY SEVERITY (open + confirmed only)")
    live = [r for r in rows if r["status"] in ("open", "confirmed")]
    for s in SEVERITIES:
        n = len([r for r in live if r["severity"] == s])
        if n:
            print(f"  {s:<10} {n}")
    print("\nBY AREA (open + confirmed only)")
    for a, n in sorted(by_area.items(), key=lambda t: -t[1]):
        n_live = len([r for r in live if r["area"] == a])
        if n_live:
            print(f"  {a:<10} {n_live}")

    no_verify = len([r for r in live if not r.get("verify")])
    never_checked = len([r for r in live if not r.get("verified_at")])
    print(f"\nHEALTH")
    print(f"  {no_verify} live finding(s) have no verify step (uncloseable)")
    print(f"  {never_checked} live finding(s) never re-verified (may already be fixed)")


def cmd_render(args) -> None:
    """Human-readable view. Regenerate after every change; never hand-edit."""
    rows = load()
    live = [r for r in rows if r["status"] in ("open", "confirmed")]
    live.sort(key=lambda r: (sev_rank(r), r["id"]))

    out = [
        "# SwingBy bug ledger",
        "",
        f"> Generated by `python tools/bugctl.py render` @ {git_head()} on {today()}.",
        "> **Do not hand-edit** — the source of truth is `docs/bugs/ledger.jsonl`.",
        "",
        f"**{len(live)} live** · {len([r for r in rows if r['status'] == 'fixed'])} fixed"
        f" · {len([r for r in rows if r['status'] == 'stale'])} stale"
        f" · {len([r for r in rows if r['status'] == 'wontfix'])} wontfix",
        "",
    ]
    for sev in SEVERITIES:
        chunk = [r for r in live if r["severity"] == sev]
        if not chunk:
            continue
        out += [f"## {sev.upper()} ({len(chunk)})", ""]
        for r in chunk:
            checked = r["verified_at"][:10] if r.get("verified_at") else "never re-verified"
            out += [
                f"### {r['id']} — {r['title']}",
                "",
                f"- **status** `{r['status']}` · **area** `{r['area']}` · "
                f"found {r['found']} by {r['found_by']} · checked {checked}",
            ]
            if r.get("files"):
                out.append("- **files** " + ", ".join(f"`{f}`" for f in r["files"]))
            if r.get("screenshot"):
                out.append(f"- **screenshot** `{r['screenshot']}`")
            if r.get("repro"):
                out.append(f"- **repro** {r['repro']}")
            if r.get("evidence"):
                out.append(f"- **evidence** {r['evidence']}")
            if r.get("verify"):
                out.append(f"- **verify** `{r['verify']}`")
            else:
                out.append("- **verify** ⚠️ MISSING — cannot be closed until one is written")
            if r.get("fix_hint"):
                out.append(f"- **fix** {r['fix_hint']}")
            for n in r.get("notes", []):
                out.append(f"- _note_ {n}")
            out.append("")

    closed = [r for r in rows if r["status"] in ("fixed", "stale", "wontfix")]
    if closed:
        out += ["---", "", f"## Closed ({len(closed)})", ""]
        for r in sorted(closed, key=lambda r: r["id"]):
            when = r.get("closed") or (r.get("verified_at") or "")[:10]
            out.append(f"- `{r['id']}` **{r['status']}** {when} — {r['title']}")
        out.append("")

    print("\n".join(out))


# ---------------------------------------------------------------- cli


def main() -> None:
    p = argparse.ArgumentParser(prog="bugctl", description=__doc__.split("Usage")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add", help="file a new finding")
    a.add_argument("--title", required=True)
    a.add_argument("--severity", choices=SEVERITIES, default="broken")
    a.add_argument("--area", choices=AREAS, default="backend")
    a.add_argument("--file", action="append", help="path:line — repeatable")
    a.add_argument("--evidence", help="the proof: what the code actually does")
    a.add_argument("--repro", help="steps a human follows to see it")
    a.add_argument("--verify", required=True, help="the check that proves it fixed")
    a.add_argument("--fix", help="suggested fix, one line")
    a.add_argument("--screenshot", help="path to a walkthrough screenshot")
    a.add_argument("--by", default="claude")
    a.add_argument("--force", action="store_true", help="add even if a duplicate")
    a.set_defaults(func=cmd_add)

    a = sub.add_parser("import", help="bulk add from a JSON array of findings")
    a.add_argument("path")
    a.add_argument("--by", default="scan-agent")
    a.set_defaults(func=cmd_import)

    a = sub.add_parser("list", help="list findings")
    a.add_argument("--status", nargs="*", choices=STATUSES)
    a.add_argument("--severity", nargs="*", choices=SEVERITIES)
    a.add_argument("--area", nargs="*", choices=AREAS)
    a.add_argument("--grep")
    a.set_defaults(func=cmd_list)

    a = sub.add_parser("show", help="full detail for one finding")
    a.add_argument("id")
    a.set_defaults(func=cmd_show)

    a = sub.add_parser("check", help="is this already known? run BEFORE filing")
    a.add_argument("text")
    a.set_defaults(func=cmd_check)

    a = sub.add_parser("verified", help="record a re-verification against HEAD")
    a.add_argument("id")
    a.add_argument("--result", choices=["still-broken", "gone"], required=True)
    a.add_argument("--note")
    a.set_defaults(func=cmd_verified)

    a = sub.add_parser("close", help="mark fixed (requires a passing verify step)")
    a.add_argument("id")
    a.add_argument("--commit", default="HEAD")
    a.add_argument("--verified", action="store_true", help="I ran the verify step and it passed")
    a.add_argument("--note")
    a.add_argument("--force", action="store_true")
    a.set_defaults(func=cmd_close)

    a = sub.add_parser("edit", help="amend a finding")
    a.add_argument("id")
    a.add_argument("--title")
    a.add_argument("--severity", choices=SEVERITIES)
    a.add_argument("--area", choices=AREAS)
    a.add_argument("--status", choices=STATUSES)
    a.add_argument("--verify")
    a.add_argument("--evidence")
    a.add_argument("--repro")
    a.add_argument("--screenshot")
    a.add_argument("--fix")
    a.add_argument("--file", action="append")
    a.set_defaults(func=cmd_edit)

    a = sub.add_parser("note", help="append a dated note")
    a.add_argument("id")
    a.add_argument("text")
    a.set_defaults(func=cmd_note)

    a = sub.add_parser("next", help="what to fix now, ranked")
    a.add_argument("--limit", type=int, default=10)
    a.set_defaults(func=cmd_next)

    a = sub.add_parser("stale", help="findings nobody re-checked recently")
    a.add_argument("--days", type=int, default=14)
    a.set_defaults(func=cmd_stale)

    a = sub.add_parser("stats", help="ledger health")
    a.set_defaults(func=cmd_stats)

    a = sub.add_parser("render", help="write the human-readable LEDGER.md to stdout")
    a.set_defaults(func=cmd_render)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
