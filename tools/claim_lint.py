#!/usr/bin/env python3
r"""Grep the repo for claims FACTS.md bans.

Why this exists
---------------
The 50/50 staged-release claim has been killed four times: 2026-07-29 (store
listing pulled), 07-31 (04-positioning rewritten), 08-01 (PR #86, "The 50/50
claim was not dead"), 08-11 (a draft pulled off the approval gate). Each fix
patched the file in front of it. On 2026-08-12 a sweep found the claim alive in
three more places, including MARKETING-PLAN.md — the document headed "For
sharing with investors."

PR #84 shipped a guard test for this and it passed the whole time, because its
patterns matched the past participle "released" while the surviving copy said
"releases". So the money patterns below match on STEMS (releas\w*, verif\w*) in
proximity to the thing that makes them a claim, never on literal forms. A
one-character tense gap is the documented failure mode here, twice.

The rule this enforces is FACTS.md's own: if a claim is not on that page, it
does not ship.

WHAT THIS TOOL CANNOT DO — read this before trusting a green run
----------------------------------------------------------------
It greps source. That is necessary and it is not sufficient, because a claim
can be assembled at runtime out of strings that are each individually clean.

The live example, found by capturing the client Booking Details screen off a
build of current main on 2026-08-11:

    Funds held in escrow
    Released when you approve      $369.00
    Released on completion

Three states rendered. `BookingDetailsScreen.js:324-325` defines **two**. The
third is the 50/50 ladder reappearing in the UI, and:

  - a grep over mobile/src returns CLEAN on that file today;
  - `booking-money-fields.test.js` is green, because the assertions cover
    states that can never co-render.

Three green signals and the ladder renders anyway. Anything that describes
money must also be checked against **rendered output** — a screenshot of the
real screen — not just against source and tests. This tool does not do that and
cannot be made to.

Usage
-----
    python tools/claim_lint.py                # scan the default roots
    python tools/claim_lint.py marketing web  # scan specific roots
    python tools/claim_lint.py --all          # show REVIEW hits too

Exit codes: 0 clean, 1 at least one FAIL, 2 bad invocation.

FAIL vs REVIEW
--------------
A banned string inside a markdown blockquote is reported as REVIEW, not FAIL.
The convention in marketing/ is that a correction note quotes the claim it
removed, so those lines are deliberate. Everything else is a FAIL.

That exemption is narrow and it is not free: some files put publishable sample
copy in blockquotes too (12-social-media-playbook.md does). REVIEW hits are
real findings that a human has to read — they are just not build-breaking.

Scope
-----
Rules are either "all" or "public".

  all     — the payment model (§2, §2.1, §2.2, §2.4). Wrong anywhere is wrong.
            Internal strategy docs are exactly where the 50/50 claim incubated
            before it reached a customer, so they are not exempt.

  public  — rules about what may be *advertised* (§4 social proof, §5 launch
            state, §1 domains). FACTS bans advertising auto-bidding; it does
            not ban a strategy doc explaining why we don't. "public" means
            content-library/, launch/, templates/, support/, campaigns/,
            social-assets/, web/ and mobile/src.

Suppression
-----------
Append `<!-- lint-ok -->` to a line that must name a banned thing on purpose —
a heading for the section that bans it, say. Use it rarely; every use is
greppable and should be obvious to a reader.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

DEFAULT_ROOTS = ["marketing", "web", "mobile/src", "docs"]

SCAN_SUFFIXES = {".md", ".txt", ".html", ".js", ".jsx", ".ts", ".tsx", ".json"}

# Files that are allowed to contain every banned string, because documenting
# them is their job.
EXEMPT_FILES = {
    "marketing/FACTS.md",
    "tools/claim_lint.py",
}

EXEMPT_DIR_PARTS = {
    "node_modules", ".git", "dist", "build", "appbuild", "__pycache__",
    ".expo", "coverage", ".pytest_cache", ".ruff_cache",
}

# Directories whose contents are copy meant to reach a human.
PUBLIC_PREFIXES = (
    "marketing/content-library/",
    "marketing/launch/",
    "marketing/templates/",
    "marketing/support/",
    "marketing/campaigns/",
    "marketing/social-assets/",
    "marketing/video/",
    "web/",
    "mobile/src/",
)

SUPPRESS = re.compile(r"<!--\s*lint-ok\s*-->")

# (label, FACTS section, scope, regex)
#
# Written case-insensitive and deliberately loose. A false positive costs
# someone ten seconds; a false negative is how the 50/50 claim survived a
# dedicated PR and its guard test.
RULES: list[tuple[str, str, str, str]] = [
    # -- §2 the payment model -------------------------------------------------
    # STEMS, not literals. releas\w* covers release/releases/released/releasing;
    # PR #84's guard died on exactly that gap. The proximity term (half|50|
    # completion|booking) is what turns a neutral word into a claim.
    ("50/50 split", "§2", "all", r"\b(half|50\s?%)\b[^.\n]{0,40}\breleas\w*"),
    ("50/50 split", "§2", "all", r"\breleas\w*[^.\n]{0,40}\b(half|50\s?%)\b"),
    ("50/50 split", "§2", "all", r"half (at|on) (booking|completion)"),
    ("50/50 split", "§2", "all", r"\b(50\s?%|half)\s+(up ?front|now|at booking)"),
    ("50/50 split", "§2", "all", r"pay half"),
    ("50/50 split", "§2", "all", r"stag\w+ (payment|release|split)"),
    ("50/50 split", "§2", "all", r"balance only on completion"),
    # Added 2026-08-12. The founder blog said "paid in two tranches — 50% when
    # the booking is confirmed, 50% when the job is marked complete" and every
    # earlier pattern missed it.
    ("50/50 split", "§2", "all", r"\btranche"),
    # Added 2026-08-12, SECOND pass. This file's own header says the claim has
    # been killed four times; it was alive a fifth time in the cold-outreach
    # email at 11c-customer-acquisition.md:47 — "50% lands with you right away
    # — the rest on completion" — and THIS LINTER REPORTED THE TREE CLEAN.
    #
    # Every pattern above needs the number to sit next to releas\w*, or one of
    # a short list of literals (up front / now / at booking / pay half). The
    # live copy used a verb none of them knew ("lands"), so the whole rule set
    # walked past a false statement about a business's money in send-ready copy.
    #
    # So: stop requiring the RELEASE verb. Two independent shapes now catch it —
    # the amount next to any arrival phrasing, and the giveaway second clause,
    # which is a claim on its own even with no number anywhere near it.
    (
        "50/50 split",
        "§2",
        "all",
        r"\b(50\s?%|half)\b[^.\n]{0,40}\b(land\w*|arriv\w*|hit\w*|in your account|"
        r"arrives|right away|straight away|immediately|instantly|same day|"
        r"on acceptance|when they accept|once they accept)",
    ),
    (
        "50/50 split",
        "§2",
        "all",
        r"\b(the rest|the remainder|the other half|the balance|remaining 50\s?%)"
        r"\b[^.\n]{0,25}\b(on|at|after|upon) completion",
    ),
    # Kept narrow on purpose: "Deep clean adds 30–50%." and the cancellation
    # ladder's own "50%" are legitimate.
    ("50/50 split", "§2", "all", r"50\s?%\s+(when|on|at)\b"),
    ("50/50 split", "§2", "all", r"(two|2)\s+(payments?|instal?ments?|parts?|stages?)"),
    ("50/50 split", "§2", "all", r"the (rest|remainder|other half) (releas\w*|is releas\w*)"),
    ("50/50 split", "§2", "all", r"releas\w*[^.\n]{0,30}\bat booking\b"),
    ("charge timing", "§2", "all", r"pay after the job"),
    ("charge timing", "§2", "all", r"only charg\w+ (you )?when you'?re happy"),
    # Completion alone releases nothing — the CLIENT APPROVING does.
    ("release trigger", "§2", "all", r"releas\w*[^.\n]{0,30}(when|once|on)[^.\n]{0,20}"
                                     r"(the (work|job) is (done|complete)|completion)"),
    ("release trigger", "§2", "all", r"releas\w*[^.\n]{0,20}to the (pro|business) once"),

    # -- §2.1 there is no scheduler -------------------------------------------
    ("no scheduler", "§2.1", "all", r"auto(matically)?[- ]?releas"),
    ("no scheduler", "§2.1", "all", r"released after 24 ?h"),
    ("no scheduler", "§2.1", "all", r"we'?ll (release|remind|notify)"),
    # A stated deadline for US to act is a scheduler promise. A deadline for the
    # USER to act (the cancellation ladder) is not — hence the leading verb.
    ("no scheduler", "§2.1", "all",
     r"(we|our team|support)\s+\w*\s*(respond|reply|review|resolve)\w*\s+within \d+"),
    ("no scheduler", "§2.1", "all", r"within \d+ ?(h|hours|hrs)\b[^|]*\bwe'?(ll| will)\b"),

    # -- §2.2 a business subscription exists ----------------------------------
    ("subscription denial", "§2.2", "all", r"no monthly fee"),
    ("subscription denial", "§2.2", "all", r"no subscriptions?\b"),
    ("subscription denial", "§2.2", "all", r"no paid tiers"),
    ("subscription denial", "§2.2", "all", r"free for businesses"),
    ("subscription denial", "§2.2", "all", r"we only make money when you"),
    ("subscription denial", "§2.2", "all", r"only charge 10% when you get paid"),

    # -- §2.4 where the money sits --------------------------------------------
    # Deliberately narrow: "two separate accounts" (a real support answer about
    # sign-ups) is not a custody claim.
    ("custody claim", "§2.4", "all",
     r"(separate|segregated|trust)\s+(escrow|bank|holding|client)\s+account"),
    ("custody claim", "§2.4", "all", r"(held|kept|sits?)\s+in\s+a\s+(separate|trust|segregated)"),
    ("custody claim", "§2.4", "all", r"never touches our account"),
    ("custody claim", "§2.4", "all", r"\b(fdic|cdic)\b"),

    # -- §4 invented social proof ---------------------------------------------
    # verif\w* covers verify/verified/verifies/verification — same stem rule.
    ("verification claim", "§4", "public", r"verif\w*\s+(business(es)?|pros?|before|by us)"),
    ("verification claim", "§4", "public", r"verif\w*\s+(reviews?|badge)"),
    ("verification claim", "§4", "public", r"\bvet(ted|ting|s)?\b"),
    ("invented rating", "§4", "public", r"\btop[- ]rated\b"),
    ("invented rating", "§4", "public", r"real (reviews|ratings)"),
    ("invented count", "§4", "public", r"\b\d+\s+(verified|vetted|trusted)\s+\w+"),
    ("invented count", "§4", "public", r"\b\d+\s+pros? near you"),
    ("invented count", "§4", "public", r"trusted by \d+"),
    ("invented count", "§4", "public", r"as seen in"),

    # -- §4 features that are not claimable -----------------------------------
    ("apple pay", "§4", "public", r"apple pay"),
    ("auto-bidding", "§4", "public", r"auto[- ]?(bid|bidding|quoting)"),
    ("payouts", "§4", "public", r"cash out"),
    ("payouts", "§4", "public", r"start earning (today|now)"),
    ("payouts", "§4", "public", r"get paid (today|this week|instantly|fast)"),

    # -- §5 launch state ------------------------------------------------------
    # "never cite it" is unqualified, so this one is scope=all.
    ("dead launch date", "§5", "all", r"\baug(ust)?\.? ?31\b"),
    ("not on the store", "§5", "public", r"download (the app|on the app store)"),
    ("not launched", "§5", "public", r"now live in calgary"),

    # -- §1 / §0 identity -----------------------------------------------------
    ("domain we don't own", "§1", "public", r"swingbyapp\.(com|ca)"),
    ("domain we don't own", "§1", "public", r"\bswingby\.(com|ca|app)\b"),
]

# Lines matching these are never reported — they are how the docs refer to the
# dead name and to other companies that legitimately use it.
LINE_EXEMPTIONS = [
    r"@SwingByApp",
    r"/SwingByApp",
    r"SwingBy UG",
    r"Markham",
    r"SwingBy2024!",
    r"one-y",
]

WORDMARK = re.compile(r"\bSwingBy(?![a-z])")

# The OTHER wrong spelling, and the one that actually shipped. FACTS §0 was
# corrected on 2026-08-08 to "the B is capital" — the mark draws a capital B —
# but the rule above only ever looked for the dead one-y name, so lowercase-b
# `Swingbyy` sailed through. marketing/video rendered it into every frame of
# every reel until 2026-08-22 with a green lint the whole time.
#
# Case-sensitive on purpose, and `S` must be capital: the domain `swingbyy.com`
# and the handles `@swingbyy` / `@swingbyyy` are addresses, are correctly
# lowercase, and §0 exempts them explicitly.
WORDMARK_LOWER_B = re.compile(r"\bSwingbyy?\b")

COMPILED = [(label, section, scope, re.compile(pat, re.I))
            for label, section, scope, pat in RULES]
EXEMPT_LINE = [re.compile(p, re.I) for p in LINE_EXEMPTIONS]


def iter_files(roots: list[str]):
    for root in roots:
        base = REPO / root
        if not base.exists():
            continue
        if base.is_file():
            yield base
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
                continue
            if EXEMPT_DIR_PARTS & set(path.parts):
                continue
            yield path


def rel(path: Path) -> str:
    return path.relative_to(REPO).as_posix()


# The one FACTS.md, in the brain. Not in this repo, on purpose.
BRAIN_FACTS = REPO.parent.parent / "agents" / "hermes" / "roles" / "FACTS.md"
REPO_FACTS_COPIES = ["marketing/FACTS.md", "docs/FACTS.md", "FACTS.md"]


def check_facts_single_source() -> list[str]:
    """There must be exactly one FACTS.md, and it must not live in this repo.

    A second copy plus a "keep these in sync" note is a convention, and a
    convention is what this whole tool exists to replace. If someone adds a
    copy back, this fails unless it is byte-identical to the brain's.
    """
    problems = []
    for candidate in REPO_FACTS_COPIES:
        copy = REPO / candidate
        if not copy.exists():
            continue
        if not BRAIN_FACTS.exists():
            problems.append(
                f"{candidate}: an in-repo FACTS.md exists but the brain copy was "
                f"not found at {BRAIN_FACTS}. Cannot verify it is current — and "
                f"an unverifiable claim boundary is worse than none.")
            continue
        if copy.read_bytes() != BRAIN_FACTS.read_bytes():
            problems.append(
                f"{candidate}: DIVERGED from {BRAIN_FACTS}. This is the drift "
                f"this tool exists to catch. Delete the copy and reference the "
                f"brain, or re-sync it deliberately.")
    return problems


def scan(path: Path, check_wordmark: bool):
    """Yield (severity, line_no, label, section, line)."""
    name = rel(path)
    if name in EXEMPT_FILES:
        return
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return

    is_public = name.startswith(PUBLIC_PREFIXES)

    for n, line in enumerate(text.splitlines(), 1):
        if any(x.search(line) for x in EXEMPT_LINE) or SUPPRESS.search(line):
            continue
        # A correction note quotes the claim it removed. Convention in
        # marketing/ is that those live in blockquotes.
        quoted = line.lstrip().startswith(">")
        severity = "REVIEW" if quoted else "FAIL"

        for label, section, scope, pat in COMPILED:
            if scope == "public" and not is_public:
                continue
            if pat.search(line):
                yield severity, n, label, section, line.strip()

        if check_wordmark and WORDMARK.search(line):
            yield severity, n, "dead one-y wordmark", "§0", line.strip()

        if check_wordmark and WORDMARK_LOWER_B.search(line):
            yield severity, n, "lowercase-b wordmark (write SwingByy)", "§0", line.strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("roots", nargs="*", default=None,
                    help=f"paths to scan (default: {' '.join(DEFAULT_ROOTS)})")
    ap.add_argument("--all", action="store_true",
                    help="print REVIEW hits (quoted in correction notes) too")
    ap.add_argument("--no-wordmark", action="store_true",
                    help="skip the one-y SwingBy check")
    args = ap.parse_args()

    roots = args.roots or DEFAULT_ROOTS
    fails: list[tuple[str, int, str, str, str]] = []
    reviews: list[tuple[str, int, str, str, str]] = []

    for path in iter_files(roots):
        for severity, n, label, section, line in scan(path, not args.no_wordmark):
            row = (rel(path), n, label, section, line)
            (fails if severity == "FAIL" else reviews).append(row)

    def show(rows, header):
        if not rows:
            return
        print(f"\n{header}")
        print("=" * len(header))
        for f, n, label, section, line in rows:
            snippet = line if len(line) <= 110 else line[:107] + "..."
            print(f"{f}:{n}: [{section} {label}] {snippet}")

    facts_problems = check_facts_single_source()
    if facts_problems:
        print("\nFAIL — FACTS.md is not a single source")
        print("=" * 38)
        for p in facts_problems:
            print(f"  {p}")

    show(fails, f"FAIL — {len(fails)} banned claim(s) in shippable copy")
    if args.all:
        show(reviews, f"REVIEW — {len(reviews)} in blockquotes (correction notes, or "
                      f"sample copy that happens to be quoted)")

    print()
    if facts_problems and not fails:
        print(f"FAILED: {len(facts_problems)} FACTS.md single-source problem(s).")
        return 1
    if fails:
        by_section: dict[str, int] = {}
        for _, _, _, section, _ in fails:
            by_section[section] = by_section.get(section, 0) + 1
        summary = ", ".join(f"{k} x{v}" for k, v in sorted(by_section.items()))
        print(f"FAILED: {len(fails)} hit(s) — {summary}")
        print("Every one of these must be fixed or moved into a quoted correction "
              "note. Authority: agents/hermes/roles/FACTS.md, in the brain.")
        if not args.all and reviews:
            print(f"({len(reviews)} REVIEW hit(s) hidden — pass --all to see them.)")
        return 1

    print(f"clean — no banned claims in shippable copy across: {', '.join(roots)}")
    if reviews and not args.all:
        print(f"({len(reviews)} REVIEW hit(s) in blockquotes — pass --all to see them.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
