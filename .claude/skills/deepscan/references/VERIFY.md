# VERIFY — re-checking what is already known

The cheapest phase and the one that retires the most work. Roughly half of the
existing findings are expected to come back `gone`.

## Why this runs first

A scan layered on an unverified ledger inflates the pile with duplicates of bugs
that are already fixed. That is the mechanism that produced the current backlog:
sweep 1 finds a bug, someone fixes it, sweep 2 finds it again because nothing
recorded the fix, and the pile grows while the app gets better.

## Procedure

```
python tools/bugctl.py stale --days 14
python tools/bugctl.py show SB-0007
```

For each finding, in order:

1. **Read the evidence field.** It names the files and the expressions. If the
   evidence is a screenshot only, you are verifying a symptom — go find the cause
   before ruling either way.
2. **Read those files at current HEAD.** Not the graph, not memory — the file.
   Line numbers in old findings will have drifted; search for the expression, not
   the line.
3. **Decide, and be willing to say "gone".** The failure mode here is
   defensiveness — re-confirming a finding because retiring it feels like
   admitting the original was wrong. It usually was not wrong; it was fixed.
4. **Check git.** `git log -S "<the expression>" --oneline -- <file>` tells you
   whether the code changed and which commit did it. Put the commit in the note.
5. **Record it.** An unrecorded verification did not happen.

```
python tools/bugctl.py verified SB-0007 --result still-broken
python tools/bugctl.py verified SB-0007 --result gone --note "fixed by 911fd92"
```

## The three outcomes

| Result | Sets status | When |
|---|---|---|
| `still-broken` | `confirmed` | Evidence holds at HEAD. Now eligible for `bugctl next`. |
| `gone` | `stale` | No longer reproduces. Row kept forever. |
| — | leave `open` | You could not tell. Add a note saying what would settle it. |

Leaving something `open` is a legitimate outcome. Guessing is not.

**Never delete a stale finding.** A stale finding that comes back is the single
best regression signal the system has — the fingerprint will match on the next
scan and `bugctl check` will surface the old id, which tells you instantly that
this is a rebreak and needs a test, not just a fix.

## Judgement calls

**"The code changed but I can't tell if the bug is gone."** Read the commit that
changed it. If the commit message claims this fix, and the new code no longer
matches the evidence, mark `gone` and cite the commit. If it comes back, the
history is right there.

**"It reproduces but differently now."** That is a new finding plus a stale one.
Mark the old `gone` with a note pointing at the new id, and file the new one.

**"The finding was just wrong."** `gone` with a note saying so. Do not quietly
drop it — the next scan will rediscover the same wrong conclusion otherwise.

**"It's a blocker and it's still broken."** Do not stop to fix it mid-verify
unless it is a one-liner. Finish the verify pass first — it is cheap and it may
retire several findings you would otherwise have worked around. Then fix.

## Screenshot findings

`~/brain/inbox/debugging/` holds walkthrough captures. A screenshot proves a
symptom existed on some build at some time; it does not prove a cause, and it
does not prove the build was current.

Verifying one means finding the code that produces the symptom. Until you have,
it stays `open` — never `confirmed`, and never `gone` just because you could not
reproduce it by reading.

Watch for this specific trap: SB-0007 and SB-0008 (Ukrainian strings under an EN
badge) describe exactly what commit 911fd92 claims to have fixed on 2026-08-13,
but the screenshots' provenance relative to that commit is unknown. Either
answer is informative — already fixed, or a regression that needs a test. Do not
assume the first.
