#!/usr/bin/env bash
# sentinel_pr.sh — run the Sentinel against a BRANCH, before it merges.
#
# WHY THIS EXISTS
# ---------------
# The cron Sentinel (agents/claude/automation/sentinel.sh) audits `origin/main`
# every two hours — i.e. AFTER a merge. On 2026-08-11 that caught five real bugs
# in code written the same day, three of them in fixes made hours earlier:
#
#   * a Home-screen ReferenceError crash (an import that silently never landed)
#   * an admin table whose sort scrambled rows
#   * a wizard that saved 3 of the 5 fields it collected
#
# Every one of those reached `main`, and two of them reached production, because
# the only thing standing between a branch and a merge was "the tests pass".
# Tests catch what is BROKEN. Sentinel catches what is WRONG. Running it two
# hours late means the wrong thing is already deployed.
#
# So this is the same auditor, same prompt, same four classes — pointed at a
# branch diff instead of a main diff, and exiting non-zero on a BLOCKER so it
# can gate a merge.
#
# DIFFERENCES FROM THE CRON, each deliberate:
#   * No state file / watermark. A PR is audited in full, every time it is run;
#     there is no "since last time" for a branch that may be rebased.
#   * No dedupe against SENTINEL-findings.md, and it does NOT append to it.
#     Branch findings are ephemeral — if the branch merges, the cron will see
#     the code on main and file anything that survived. Appending here would
#     put findings about code that may never exist into the permanent record.
#   * Output goes to stdout (and optionally a PR comment), not Telegram. The
#     person who can act on it is the one reading the PR.
#   * Exit code is the point. 0 = safe to merge, 1 = a BLOCKER is present.
#
# USAGE
#   tools/sentinel_pr.sh                     # current branch vs origin/main
#   tools/sentinel_pr.sh <branch>            # named branch vs origin/main
#   tools/sentinel_pr.sh <branch> <base>     # explicit base
#   tools/sentinel_pr.sh --comment <pr>      # also post findings to that PR
#   tools/sentinel_pr.sh --dry-run           # print the prompt, run nothing
#
# EXIT CODES
#   0  no findings, or findings but none BLOCKER
#   1  at least one BLOCKER — do not merge
#   2  could not run (bad ref, missing tool)
set -u

KIT="${SENTINEL_KIT:-$HOME/brain/10-swingby/agents}"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "sentinel_pr: not inside a git repo" >&2; exit 2; }
MODEL=${SENTINEL_MODEL:-claude-sonnet-5}
CLAUDE_BIN=${SENTINEL_CLAUDE_BIN:-claude}

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin"

DRY_RUN=0
COMMENT_PR=""
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --comment) COMMENT_PR="${2:-}"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

BRANCH="${ARGS[0]:-$(git rev-parse --abbrev-ref HEAD)}"
BASE="${ARGS[1]:-origin/main}"

cd "$REPO_ROOT" || exit 2
git rev-parse --verify -q "$BRANCH" >/dev/null || { echo "sentinel_pr: no such ref: $BRANCH" >&2; exit 2; }
git rev-parse --verify -q "$BASE"   >/dev/null || { echo "sentinel_pr: no such base: $BASE" >&2; exit 2; }

# Compare against the MERGE BASE, not the base tip. Diffing a branch against a
# moved-on main reports every unrelated change as if this branch made it — which
# is how a reviewer learns to ignore the tool.
MERGE_BASE=$(git merge-base "$BASE" "$BRANCH") || exit 2

CHANGED=$(git diff --name-only "$MERGE_BASE" "$BRANCH" -- \
            'mobile/src/**' 'backend/app/**' 'web/*/src/**' 2>/dev/null)

if [ -z "$CHANGED" ]; then
  echo "sentinel_pr: no auditable code changed between ${MERGE_BASE:0:7} and $BRANCH"
  exit 0
fi

FILE_COUNT=$(printf '%s\n' "$CHANGED" | wc -l | tr -d ' ')

PROMPT="You are the Sentinel. Read $KIT/BOH/sentinel.md and follow it exactly.

You are auditing a BRANCH BEFORE IT MERGES, not main. Branch: $BRANCH. Base: $BASE.

Audit ONLY these $FILE_COUNT changed files:
$CHANGED

Read \`git diff $MERGE_BASE $BRANCH -- <file>\` for what actually changed, and read
the surrounding file for context — a line is often wrong because of what is
around it, not because of itself.

You are READ-ONLY. Do not edit, create, commit, push, or run any command that
changes a file. Do not append to any findings file. Report to stdout only.

THREE THINGS THIS AUDIT CATCHES THAT TESTS DO NOT, all of which shipped here:
  * A symbol that is CALLED but never imported. A render test mounts a screen
    without pressing anything, so a bad identifier inside an onPress never runs.
  * A form or flow that collects input and silently drops some of it.
  * UI copy that promises what the code it sits next to does not do.

Report each finding in exactly this format, nothing between blocks:

## [SEVERITY] [CLASS] short title
file:line
What is wrong, one or two sentences.
Proof: the specific lines or values that make it true.
Fix: the one-line change, if it is one line.

SEVERITY is BLOCKER, BROKEN or SLOPPY. CLASS is COPYWRITING, DEAD BUTTON,
WRONG ALGORITHM or WRONG NUMBERS.

Report ONLY defects introduced or left by THIS branch's changes. A pre-existing
problem in an untouched part of a file you happened to read is not this branch's
finding — the cron sweep owns main.

If you find nothing, reply exactly: NO FINDINGS. Silence is a correct and common
result. Do not invent work to look useful."

if [ "$DRY_RUN" -eq 1 ]; then
  echo "--- $BRANCH vs $BASE (merge-base ${MERGE_BASE:0:7}), $FILE_COUNT files ---"
  echo "$PROMPT"
  exit 0
fi

command -v "$CLAUDE_BIN" >/dev/null || { echo "sentinel_pr: '$CLAUDE_BIN' not on PATH" >&2; exit 2; }

echo "sentinel_pr: auditing $FILE_COUNT file(s) on $BRANCH vs ${MERGE_BASE:0:7}..." >&2
OUT=$(timeout 1800 "$CLAUDE_BIN" -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
  echo "sentinel_pr: claude exited $RC" >&2
  echo "$OUT" | tail -5 >&2
  exit 2
fi

echo "$OUT"

if printf '%s' "$OUT" | grep -q 'NO FINDINGS'; then
  echo "sentinel_pr: clean." >&2
  exit 0
fi

BLOCKERS=$(printf '%s' "$OUT" | grep -c '^## \[BLOCKER\]' || true)
TOTAL=$(printf '%s' "$OUT" | grep -c '^## \[' || true)

if [ -n "$COMMENT_PR" ] && command -v gh >/dev/null; then
  printf '## Sentinel — pre-merge audit\n\n_%s file(s) on `%s`, against merge-base `%s`._\n\n%s\n' \
    "$FILE_COUNT" "$BRANCH" "${MERGE_BASE:0:7}" "$OUT" \
    | gh pr comment "$COMMENT_PR" --body-file - >/dev/null \
    && echo "sentinel_pr: posted to PR #$COMMENT_PR" >&2
fi

echo "sentinel_pr: $TOTAL finding(s), $BLOCKERS blocker(s)." >&2
[ "$BLOCKERS" -gt 0 ] && exit 1
exit 0
