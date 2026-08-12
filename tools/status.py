#!/usr/bin/env python3
"""status.py — regenerate the truth about this repo as one HTML page.

Stdlib only. No build, no network required, no LLM. Runs in about a second.

    python3 tools/status.py            # write .status/status.html
    python3 tools/status.py --open     # ...and open it
    python3 tools/status.py --no-db    # git facts only, skip production

Two things this exists to stop:

1. A TYPED delete list. Branch names are copied by hand into `git branch -d`
   and something irreplaceable goes with them. Here the list is COMPUTED: a
   branch is only listed if it is fully contained in the trunk AND its name
   matches nothing in PROTECT_PATTERNS. `fix/escrow-guard` is held back
   automatically, because "guard" is in that tuple.

2. A "read-only" query that wasn't. Every block from tools/status_queries.sql
   is scanned for write keywords BEFORE it reaches the connection, and the
   transaction is opened READ ONLY as a second, independent guarantee. With no
   DATABASE_URL, no psycopg, or --no-db, the SQL is printed on the page for
   pasting into the Supabase editor. Either way you see the queries.

Setup, once:
    echo ".status/" >> .gitignore
    pip install "psycopg[binary]"      # optional — only for live prod counts
    export DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres"
"""

from __future__ import annotations

import argparse
import html
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# A branch whose name contains any of these is never offered for deletion,
# however merged it looks. Substring match, case-insensitive. Add anything you
# could not recreate from history.
PROTECT_PATTERNS = ("guard", "escrow", "hotfix")

TRUNK = os.environ.get("STATUS_TRUNK", "main")

# Checked against each query with word boundaries, so `updated_at` and
# `created_at` do not trip `update` / `create`. SQL comments are stripped
# first — this file's own header names these words, and so does the .sql.
WRITE_KEYWORDS = (
    "insert", "update", "delete", "drop", "alter", "truncate", "create",
    "grant", "revoke", "copy", "merge", "replace", "vacuum", "refresh",
    "reindex", "cluster", "lock", "call", "commit", "rollback", "set",
)

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / ".status"
OUT_FILE = OUT_DIR / "status.html"
QUERIES = Path(__file__).resolve().parent / "status_queries.sql"


# ── git ──────────────────────────────────────────────────────────────────────


def git(*args: str) -> str:
    """Run a git command, returning stdout. Never raises — a repo that cannot
    answer a question renders as an empty section rather than a traceback."""
    try:
        res = subprocess.run(
            ("git",) + args,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    return res.stdout.strip() if res.returncode == 0 else ""


def protected_by(name: str) -> str | None:
    low = name.lower()
    for pat in PROTECT_PATTERNS:
        if pat in low:
            return pat
    return None


def collect_branches() -> list[dict]:
    """Local branches, each with how far ahead of trunk it is and why it is or
    is not deletable.

    `ahead` is `rev-list --count trunk..branch`, so 0 means the trunk already
    contains every commit on it. NOTE: a SQUASH-merged branch still reports
    ahead > 0 — its commits are not in trunk, only their combined effect is —
    so it shows as `unmerged` and is NOT offered for deletion. That is the safe
    direction to be wrong in: this list under-reports rather than over-deletes.
    """
    raw = git(
        "for-each-ref",
        "--format=%(refname:short)\x1f%(committerdate:short)\x1f%(contents:subject)",
        "refs/heads",
    )
    branches = []
    for line in filter(None, raw.splitlines()):
        parts = line.split("\x1f")
        name = parts[0]
        date = parts[1] if len(parts) > 1 else ""
        subject = parts[2] if len(parts) > 2 else ""

        ahead_raw = git("rev-list", "--count", f"{TRUNK}..{name}")
        try:
            ahead = int(ahead_raw)
        except ValueError:
            ahead = -1  # trunk missing, or an unreadable ref

        hold = protected_by(name)
        if name == TRUNK:
            state, chip = "merged", "del"
        elif hold:
            state, chip = f"hold · matches “{hold}”", "hold"
        elif ahead != 0:
            state, chip = "unmerged", "live"
        else:
            state, chip = "deletable", "del"

        branches.append(
            {
                "name": name,
                "ahead": ahead,
                "date": date,
                "subject": subject,
                "state": state,
                "chip": chip,
                "hold": hold,
                "deletable": state == "deletable",
            }
        )

    branches.sort(key=lambda b: (b["name"] != TRUNK, -b["ahead"], b["name"]))
    return branches


# ── sql ──────────────────────────────────────────────────────────────────────


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def assert_read_only(sql: str) -> None:
    """Raise if the query could write. Runs before the connection is touched."""
    body = strip_sql_comments(sql).lower()
    for kw in WRITE_KEYWORDS:
        if re.search(rf"\b{kw}\b", body):
            raise ValueError(f"refusing to send: contains write keyword “{kw}”")
    if ";" in body.strip().rstrip(";"):
        raise ValueError("refusing to send: more than one statement in a block")


def load_queries() -> list[dict]:
    """Split the .sql into labelled blocks on `-- name: <label>` lines."""
    if not QUERIES.exists():
        return []
    blocks, label, buf = [], None, []

    def flush():
        if label and "".join(buf).strip():
            blocks.append({"label": label, "sql": "".join(buf).strip()})

    for line in QUERIES.read_text(encoding="utf-8").splitlines(keepends=True):
        m = re.match(r"^--\s*name:\s*(.+?)\s*$", line)
        if m:
            flush()
            label, buf = m.group(1), []
        elif label:
            buf.append(line)
    flush()
    return blocks


def run_queries(blocks: list[dict]) -> tuple[list[dict], str | None]:
    """Execute each block READ ONLY. Returns (blocks, reason-not-run)."""
    dsn = os.environ.get("DATABASE_URL", "").strip()
    if not dsn:
        return blocks, "DATABASE_URL not set"
    try:
        import psycopg  # noqa: F401
    except ImportError:
        return blocks, 'psycopg not installed (pip install "psycopg[binary]")'

    import psycopg

    try:
        conn = psycopg.connect(dsn, connect_timeout=10)
    except Exception as exc:  # noqa: BLE001 — surfaced on the page, not raised
        return blocks, f"could not connect: {exc}"

    with conn:
        conn.read_only = True  # second guarantee, independent of the scan
        for block in blocks:
            try:
                assert_read_only(block["sql"])
            except ValueError as exc:
                block["error"] = str(exc)
                continue
            try:
                with conn.cursor() as cur:
                    cur.execute(block["sql"])
                    block["cols"] = [d.name for d in (cur.description or [])]
                    block["rows"] = cur.fetchall()
            except Exception as exc:  # noqa: BLE001 — one bad query, one bad box
                block["error"] = f"{type(exc).__name__}: {exc}"
    conn.close()
    return blocks, None


# ── render ───────────────────────────────────────────────────────────────────

CSS = """
:root{
  --paper:#eef2e6; --band:#e2ebd8; --rule:#c3d0b4;
  --ink:#22261f; --soft:#5d6654;
  --stamp:#a8322a; --ok:#2f6b4f; --wait:#8a6a12;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font:14px/1.5 ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;
  padding:20px 16px 64px;
}
h1{
  font-size:13px; letter-spacing:.22em; text-transform:uppercase;
  font-weight:700; margin:0 0 2px;
}
.gen{color:var(--soft); font-size:11px; margin-bottom:22px}
h2{
  font-size:11px; letter-spacing:.2em; text-transform:uppercase;
  font-weight:700; color:var(--soft);
  margin:32px 0 8px; padding-bottom:5px; border-bottom:1px solid var(--rule);
}
.deck{display:flex; flex-wrap:wrap; gap:8px}
.card{
  flex:1 1 150px; border:1px solid var(--rule); padding:11px 13px;
  background:#fff;
}
.card .k{font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft)}
.card .v{font-size:21px; font-weight:700; margin-top:5px; word-break:break-all}
.card.alert{border-color:var(--stamp)} .card.alert .v{color:var(--stamp)}
.card.good .v{color:var(--ok)}
table{width:100%; border-collapse:collapse; font-size:12.5px}
td,th{padding:6px 8px; text-align:left; vertical-align:top}
th{
  font-size:10px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--soft); border-bottom:1px solid var(--rule); font-weight:700;
}
tbody tr:nth-child(odd){background:var(--band)}
.sha{color:var(--soft)}
.sub{color:var(--soft)}
.chip{
  display:inline-block; font-size:9.5px; letter-spacing:.14em;
  text-transform:uppercase; font-weight:700; padding:2px 6px;
  border:1.5px solid currentColor;
}
.chip.hold{color:var(--stamp); transform:rotate(-1.5deg)}
.chip.del{color:var(--soft)}
.chip.live{color:var(--wait)}
.chip.bad{color:var(--stamp)}
pre{
  background:#fff; border:1px solid var(--rule); padding:11px;
  overflow-x:auto; font-size:12px; margin:0 0 12px;
}
.note{color:var(--soft); font-size:12px; margin:0 0 12px}
.empty{color:var(--soft); padding:10px 0}
@media(max-width:560px){
  .card{flex:1 1 100%} td,th{padding:5px 6px} .hide-sm{display:none}
}
"""


def e(v) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def card(k: str, v, cls: str = "") -> str:
    return (
        f"<div class='card{(' ' + cls) if cls else ''}'>"
        f"<div class='k'>{e(k)}</div><div class='v'>{e(v)}</div></div>"
    )


def render(branches, dirty, commits, blocks, db_skip) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    head = git("rev-parse", "--abbrev-ref", "HEAD") or "(detached)"
    deletable = [b for b in branches if b["deletable"]]
    unmerged = [b for b in branches if b["state"] == "unmerged"]
    held = [b for b in branches if b["hold"] and b["name"] != TRUNK]

    p = [
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1'>",
        f"<title>repo status</title><style>{CSS}</style></head><body>",
        f"<h1>{e(ROOT.name)} — status</h1>",
        f"<p class='gen'>generated {e(now)} · trunk: {e(TRUNK)}</p>",
        "<div class='deck'>",
        card("on branch", head),
        card("uncommitted", len(dirty), "alert" if dirty else "good"),
        card("unmerged branches", len(unmerged), "alert" if unmerged else "good"),
        card("safe to delete", len(deletable)),
        "</div>",
    ]

    # Branches
    p.append("<h2>Branches</h2>")
    if branches:
        p.append(
            "<table><thead><tr><th>branch</th><th>ahead</th>"
            "<th class='hide-sm'>last commit</th><th>state</th></tr></thead><tbody>"
        )
        for b in branches:
            ahead = "?" if b["ahead"] < 0 else b["ahead"]
            p.append(
                f"<tr><td>{e(b['name'])}</td><td>{e(ahead)}</td>"
                f"<td class='hide-sm'>{e(b['date'])} "
                f"<span class='sub'>{e(b['subject'])}</span></td>"
                f"<td><span class='chip {b['chip']}'>{e(b['state'])}</span></td></tr>"
            )
        p.append("</tbody></table>")
    else:
        p.append("<p class='empty'>No branches found.</p>")
    if held:
        names = ", ".join(b["name"] for b in held)
        p.append(f"<p class='note'>Held back from any delete list: {e(names)}</p>")

    # Delete list
    p.append("<h2>Delete list</h2>")
    p.append(
        "<p class='note'>Merged into trunk, nothing protected, nothing ahead. "
        "Read it before you run it.</p>"
    )
    if deletable:
        p.append(f"<pre>git branch -d {e(' '.join(b['name'] for b in deletable))}</pre>")
    else:
        p.append("<p class='empty'>Nothing is safe to delete.</p>")

    # Uncommitted
    p.append("<h2>Uncommitted</h2>")
    p.append(f"<pre>{e(chr(10).join(dirty))}</pre>" if dirty else "<p class='empty'>Clean.</p>")

    # Commits
    p.append("<h2>Last 10 commits</h2>")
    if commits:
        p.append("<table><thead><tr><th>sha</th><th>date</th><th>subject</th></tr></thead><tbody>")
        for sha, date, subject in commits:
            p.append(
                f"<tr><td class='sha'>{e(sha)}</td><td>{e(date)}</td>"
                f"<td>{e(subject)}</td></tr>"
            )
        p.append("</tbody></table>")
    else:
        p.append("<p class='empty'>No commits.</p>")

    # Production
    p.append("<h2>Production</h2>")
    if not blocks:
        p.append(f"<p class='empty'>No queries — {e(QUERIES.name)} not found.</p>")
    else:
        if db_skip:
            p.append(
                f"<p class='note'>Not run — {e(db_skip)}. "
                "Paste these into the Supabase SQL editor:</p>"
            )
        for b in blocks:
            p.append(f"<p class='note'>{e(b['label'])}</p>")
            if b.get("error"):
                p.append(f"<p class='note'><span class='chip bad'>error</span> {e(b['error'])}</p>")
                p.append(f"<pre>{e(b['sql'])}</pre>")
            elif "rows" in b:
                if b["rows"]:
                    p.append("<table><thead><tr>")
                    p.extend(f"<th>{e(c)}</th>" for c in b["cols"])
                    p.append("</tr></thead><tbody>")
                    for row in b["rows"]:
                        p.append("<tr>" + "".join(f"<td>{e(v)}</td>" for v in row) + "</tr>")
                    p.append("</tbody></table>")
                else:
                    p.append("<p class='empty'>No rows.</p>")
            else:
                p.append(f"<pre>{e(b['sql'])}</pre>")

    p.append("</body></html>")
    return "\n".join(p)


# ── main ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--open", action="store_true", help="open the page when done")
    ap.add_argument("--no-db", action="store_true", help="skip production queries")
    args = ap.parse_args()

    if not git("rev-parse", "--git-dir"):
        print(f"not a git repository: {ROOT}", file=sys.stderr)
        return 1

    branches = collect_branches()
    dirty = [ln for ln in git("status", "--porcelain").splitlines() if ln.strip()]
    commits = [
        line.split("\x1f")
        for line in git("log", "-10", "--format=%h\x1f%ad\x1f%s", "--date=short").splitlines()
        if line
    ]
    commits = [c for c in commits if len(c) == 3]

    blocks = load_queries()
    db_skip = "--no-db" if args.no_db else None
    if blocks and not args.no_db:
        blocks, db_skip = run_queries(blocks)

    OUT_DIR.mkdir(exist_ok=True)
    OUT_FILE.write_text(render(branches, dirty, commits, blocks, db_skip), encoding="utf-8")

    deletable = sum(1 for b in branches if b["deletable"])
    held = [b["name"] for b in branches if b["hold"] and b["name"] != TRUNK]
    print(f"wrote {OUT_FILE.relative_to(ROOT)}")
    print(f"  branches {len(branches)} · deletable {deletable} · uncommitted {len(dirty)}")
    if held:
        print(f"  held back by PROTECT_PATTERNS: {', '.join(held)}")
    if db_skip:
        print(f"  production: not run ({db_skip}) — SQL printed on the page")

    if args.open:
        import webbrowser

        webbrowser.open(OUT_FILE.as_uri())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
