# `.claude/secrets/`

**This folder is gitignored except for templates and this README.**

It holds credential files that autonomous Claude CLI runs read at runtime. Live credential files (matching `*.txt` but not `*.template.txt`) are excluded from git.

## How to use

1. Copy a template:
   ```bash
   cp .claude/secrets/social-credentials.template.txt .claude/secrets/social-credentials.txt
   ```
2. Open `.claude/secrets/social-credentials.txt` and fill in real values.
3. Run the Phase 2 brief — Claude will read this file, wire credentials into n8n, and test each connection.
4. **Do not commit the filled-in file.** The `.gitignore` blocks it, but verify with `git status` before committing.

## Files in this folder

| File | Committed? | Purpose |
|---|---|---|
| `README.md` | yes | This file |
| `*.template.txt` | yes | Empty templates with placeholders |
| `*.txt` (live) | **no** | Real credentials, gitignored |
| `.gitkeep` | yes | Keeps folder in git when otherwise empty |
