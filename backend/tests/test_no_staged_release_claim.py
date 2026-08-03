"""The 50/50 release does not exist. Nothing may claim it does.

HISTORY, because this kept coming back:

The original spec described a staged release — half the business's money on
date-confirm, half on completion. The CODE never did it. `budget_settlement`
shipped `settle_on_date_confirmed` / `settle_on_complete` implementing exactly
that split, correct and unit-tested, with NO CALLERS; `confirm_date` never
called them, and `release_escrow_on_complete` always moved the whole balance in
one go. So a wrong model lived on as tested, unreachable code that read like a
specification — and the claim spread from there.

It was pulled from the App Store listing (2026-07-29), then from five marketing
files (2026-07-31), then from two mobile screens (2026-08-01), and it was STILL
on the live pre-launch site, in the support knowledge base, in the marketing
plan and in this repo's own tip about not over-promising.

THE ACTUAL RULE (services/approvals.py): the money is charged and HELD when the
client accepts a quote, and released when the client APPROVES the finished work
— or automatically 24 hours after the business marks it done. SwingBy keeps 10%.

This test is the reason it cannot come back a seventh time.
"""

import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[2]

# Where user-facing claims live. Test files are excluded — they must be able to
# NAME the wrong claim in order to assert against it, as this file does.
SEARCH_DIRS = [
    REPO / "web" / "pre-launch" / "src",
    REPO / "web" / "launch" / "src",
    REPO / "marketing",
    REPO / "mobile" / "src",
    REPO / "backend" / "app",
]
SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".py"}

# Deliberately narrow. "50%" alone is legitimate — the cancellation ladder has a
# real 50/50 rung (after the scheduled date), and the platform cut is a
# percentage. These patterns describe a STAGED RELEASE specifically.
CLAIMS = [
    re.compile(r"50\s*%\s*(?:is\s+)?released", re.I),
    re.compile(r"50\s*%\s*on\s+(?:booking\s+)?confirm", re.I),
    re.compile(r"half\s+(?:is\s+)?released", re.I),
    re.compile(r"half\s+at\s+booking", re.I),
    re.compile(r"half\s+up\s+front", re.I),
    re.compile(r"released\s+in\s+(?:two\s+)?stages", re.I),
    re.compile(r"pay\s+in\s+two\s+stages", re.I),
    re.compile(r"splits?\s+payment\s*[—-]\s*half", re.I),
    # Missed on the first pass: "half the payment RELEASES" has no "is", and
    # "money moves in two steps" never says 50 at all. Both shipped.
    re.compile(r"half\s+(?:of\s+)?the\s+payment\s+release", re.I),
    re.compile(r"(?:money|payment)\s+moves?\s+in\s+two\s+(?:steps|stages)", re.I),
    re.compile(r"the\s+(?:other|final|remaining)\s+half\s+of\s+the\s+payment", re.I),
]

# The cancellation ladder, which was ALSO stated backwards in two places — the
# live Terms page and an Instagram draft both charged 25% for cancelling EARLY,
# which is the free rung. escrow.compute_cancellation_split is the authority:
#   client, >48h before the date        -> 100% refund, no fee
#   client, <=48h                       -> 75% refund, business keeps 25%
#   client, after the scheduled time    -> 50/50
#   business, any time                  -> 100% refund
LADDER_LIES = [
    re.compile(
        r"25%\s*(?:of the job amount\s*)?(?:fee\s*)?(?:applies\s*)?(?:if\s+)?(?:cancelled\s+)?more than 48",
        re.I,
    ),
    re.compile(r"more than 48 hours[^.]{0,40}(?:25|50)\s*%", re.I),
    re.compile(r"25%\s+more than 48", re.I),
]


def _files():
    for root in SEARCH_DIRS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix not in SUFFIXES or not path.is_file():
                continue
            if "node_modules" in path.parts or "__tests__" in path.parts:
                continue
            if path.name.startswith("test_") or path.name.endswith(".test.js"):
                continue
            yield path


def test_nothing_claims_a_staged_5050_release():
    hits = []
    for path in _files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        is_code = path.suffix in {".py", ".js", ".jsx", ".ts", ".tsx"}
        for line_no, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            # In code, a COMMENT naming the old claim is how the fix explains
            # itself — this file does the same. What must never appear is the
            # claim in a STRING a user can read. Markdown is scanned whole,
            # because there the prose IS the product.
            if is_code and (
                stripped.startswith("//")
                or stripped.startswith("#")
                or stripped.startswith("*")
            ):
                continue
            for pattern in CLAIMS:
                if pattern.search(line):
                    hits.append(
                        f"{path.relative_to(REPO)}:{line_no}: {line.strip()[:110]}"
                    )

    assert hits == [], (
        "A staged 50/50 release is claimed in "
        f"{len(hits)} place(s). It does not exist in the code — money is held "
        "on accept and released on the client's approval (or 24h after the "
        "business marks the work done).\n\n" + "\n".join(hits)
    )


def test_no_copy_states_the_cancellation_ladder_backwards():
    """Cancelling EARLY is free. Two places said it costs 25%.

    The live pre-launch Terms page and an Instagram draft both charged a fee
    for the one cancellation that has none — in the Terms' case, as terms of
    service.
    """
    hits = []
    for path in _files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        is_code = path.suffix in {".py", ".js", ".jsx", ".ts", ".tsx"}
        for line_no, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            if is_code and (
                stripped.startswith("//")
                or stripped.startswith("#")
                or stripped.startswith("*")
            ):
                continue
            for pattern in LADDER_LIES:
                if pattern.search(line):
                    hits.append(
                        f"{path.relative_to(REPO)}:{line_no}: {line.strip()[:110]}"
                    )

    assert hits == [], (
        "Copy charges a fee for cancelling MORE than 48h ahead. That rung is "
        "free (escrow.compute_cancellation_split).\n\n" + "\n".join(hits)
    )


def test_the_functions_that_implemented_it_are_gone():
    from app.services import budget_settlement

    # Their existence is what made the claim look backed by code.
    assert not hasattr(budget_settlement, "settle_on_date_confirmed")
    assert not hasattr(budget_settlement, "settle_on_complete")
