#!/usr/bin/env python3
"""notify.py — send one short message to Telegram.

Stdlib only, no dependencies. Dry run by DEFAULT, exactly like
tools/social_post.py: nothing leaves this machine unless you pass --send.

    python3 tools/notify.py --check                  # what is configured?
    python3 tools/notify.py "deploy is green"        # DRY RUN — prints, sends nothing
    python3 tools/notify.py "deploy is green" --send # actually sends
    make status-open && python3 tools/notify.py --file .status/summary.txt --send
    echo "build failed" | python3 tools/notify.py --send

Setup, once:

 1. Talk to @BotFather in Telegram -> /newbot -> it gives you a token that
    looks like 8123456789:AAH...  That is TELEGRAM_BOT_TOKEN.
 2. Send your new bot any message from the chat you want notified. A bot
    cannot start a conversation — this step is what makes it possible for it
    to message you at all, and skipping it is the usual reason sends 403.
 3. python3 tools/notify.py --whoami        # prints the chat ids it can see
 4. Put both in .env.notify (gitignored):

        TELEGRAM_BOT_TOKEN=8123456789:AAH...
        TELEGRAM_CHAT_ID=-1001234567890

The token is a bearer credential for the whole bot: anyone holding it can read
and send everything the bot can. It is never printed by this script — --check
and every error path redact it — and .env.notify is gitignored. Do not paste it
into a commit, an issue, or a chat.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV_FILE = REPO / ".env.notify"

REQUIRED = ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID")

API = "https://api.telegram.org"
TIMEOUT = 20.0

# Telegram hard-rejects a sendMessage body over 4096 UTF-16 code units. Splitting
# is better than truncating: a status line cut mid-sentence reads like the job
# died there.
LIMIT = 4096


def load_dotenv(path: Path = ENV_FILE) -> None:
    """Read a local .env.notify if present. Never committed — see .gitignore."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def missing() -> list[str]:
    return [k for k in REQUIRED if not os.environ.get(k)]


def redact(text: str) -> str:
    """Strip the bot token out of anything on its way to a terminal or a log.

    Telegram puts the token in the URL PATH, so an unredacted urllib error
    message leaks the whole credential into CI output. That is the single most
    likely way this file gets someone owned, so it is handled in one place and
    every print goes through it.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if token:
        text = text.replace(token, "<TELEGRAM_BOT_TOKEN>")
        head = token.split(":", 1)[0]
        if head and head != token:
            text = text.replace(head, "<BOT_ID>")
    return text


def chunk(text: str, limit: int = LIMIT) -> list[str]:
    """Split on line boundaries where possible, hard-split only when a single
    line is itself too long. Never returns an empty chunk."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= limit:
        return [text]

    out: list[str] = []
    buf = ""
    for line in text.split("\n"):
        while len(line) > limit:  # one enormous line — hard split it
            if buf:
                out.append(buf)
                buf = ""
            out.append(line[:limit])
            line = line[limit:]
        candidate = f"{buf}\n{line}" if buf else line
        if len(candidate) > limit:
            out.append(buf)
            buf = line
        else:
            buf = candidate
    if buf:
        out.append(buf)
    return [c for c in out if c.strip()]


def send_one(text: str, *, html: bool = False, silent: bool = False) -> str:
    """POST one message. Returns the message id. Raises on failure.

    No retry, deliberately — a retry on a POST that may already have landed is
    how one notification becomes two. Same rule as social_post.py.
    """
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    payload = {
        "chat_id": os.environ["TELEGRAM_CHAT_ID"],
        "text": text,
        "disable_notification": "true" if silent else "false",
    }
    if html:
        payload["parse_mode"] = "HTML"

    req = urllib.request.Request(
        f"{API}/bot{token}/sendMessage",
        data=urllib.parse.urlencode(payload).encode(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = json.loads(exc.read().decode() or "{}").get("description", "")
        except (ValueError, OSError):
            pass
        hint = ""
        if exc.code == 403:
            hint = " — send your bot a message first; a bot cannot open a chat"
        elif exc.code == 400 and "chat not found" in detail.lower():
            hint = " — wrong TELEGRAM_CHAT_ID; run --whoami"
        raise RuntimeError(redact(f"HTTP {exc.code}: {detail}{hint}")) from None
    except urllib.error.URLError as exc:
        raise RuntimeError(redact(f"could not reach Telegram: {exc.reason}")) from None

    if not body.get("ok"):
        raise RuntimeError(redact(f"telegram refused: {body.get('description')}"))
    return str(body.get("result", {}).get("message_id", "?"))


def whoami() -> int:
    """Print chat ids this bot can currently see, via getUpdates.

    Only shows chats that have messaged the bot recently — that is a Telegram
    limitation, not a bug here. If it prints nothing, message the bot and rerun.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        print("TELEGRAM_BOT_TOKEN is not set — nothing to ask.", file=sys.stderr)
        return 1
    try:
        with urllib.request.urlopen(
            f"{API}/bot{token}/getUpdates", timeout=TIMEOUT
        ) as r:
            body = json.loads(r.read().decode())
    except (urllib.error.URLError, ValueError) as exc:
        print(redact(f"getUpdates failed: {exc}"), file=sys.stderr)
        return 1

    seen = {}
    for upd in body.get("result", []):
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        if chat.get("id") is not None:
            label = (
                chat.get("title")
                or " ".join(
                    filter(None, [chat.get("first_name"), chat.get("last_name")])
                )
                or chat.get("username")
                or chat.get("type", "?")
            )
            seen[chat["id"]] = label

    if not seen:
        print("No chats visible. Send your bot a message, then run this again.")
        print(
            "(getUpdates only reports recent updates, and not at all if a webhook is set.)"
        )
        return 1
    print("Chats this bot can see — put one in TELEGRAM_CHAT_ID:\n")
    for cid, label in seen.items():
        print(f"  {cid}\t{label}")
    return 0


def read_message(args) -> str:
    if args.file:
        return Path(args.file).read_text(encoding="utf-8")
    if args.message:
        return args.message
    if not sys.stdin.isatty():
        return sys.stdin.read()
    return ""


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Send one short message to Telegram. Dry run unless --send."
    )
    parser.add_argument("message", nargs="?", help="the text (or use --file / stdin)")
    parser.add_argument(
        "--send", action="store_true", help="actually send (default is a dry run)"
    )
    parser.add_argument("--check", action="store_true", help="show what is configured")
    parser.add_argument(
        "--whoami", action="store_true", help="list chat ids the bot can see"
    )
    parser.add_argument("--file", help="read the message from a file")
    parser.add_argument("--html", action="store_true", help="parse as Telegram HTML")
    parser.add_argument(
        "--silent", action="store_true", help="deliver without a notification sound"
    )
    args = parser.parse_args(argv)

    load_dotenv()

    if args.check:
        gaps = missing()
        for key in REQUIRED:
            val = os.environ.get(key)
            if not val:
                print(f"  MISSING  {key}")
            elif key == "TELEGRAM_BOT_TOKEN":
                print(f"  set      {key} (…{val[-4:]})")  # never the whole token
            else:
                print(f"  set      {key} = {val}")
        if gaps:
            print(f"\nNot configured. Add to {ENV_FILE.name}: {', '.join(gaps)}")
            return 1
        print("\nConfigured. A message would be sent with --send.")
        return 0

    if args.whoami:
        return whoami()

    text = read_message(args)
    if not text.strip():
        parser.error("no message given (positional, --file, or stdin)")

    parts = chunk(text)
    gaps = missing()

    if not args.send:
        print(
            f"DRY RUN — nothing sent. {len(parts)} message(s), {len(text.strip())} chars."
        )
        if gaps:
            print(f"(also not configured: {', '.join(gaps)})")
        print("-" * 56)
        for i, part in enumerate(parts, 1):
            if len(parts) > 1:
                print(f"[{i}/{len(parts)}]")
            print(part)
        print("-" * 56)
        print("Add --send to deliver it.")
        return 0

    if gaps:
        print(f"Cannot send — not configured: {', '.join(gaps)}", file=sys.stderr)
        print(f"Add them to {ENV_FILE.name}, or run --check.", file=sys.stderr)
        return 1

    for i, part in enumerate(parts, 1):
        try:
            mid = send_one(part, html=args.html, silent=args.silent)
        except RuntimeError as exc:
            # Say how far it got: with 3 parts sent and part 4 failing, the
            # reader needs to know the first 3 landed.
            print(f"FAILED on message {i}/{len(parts)}: {exc}", file=sys.stderr)
            if i > 1:
                print(
                    f"({i - 1} message(s) already delivered — do not blindly rerun)",
                    file=sys.stderr,
                )
            return 1
        print(f"sent {i}/{len(parts)} (message_id {mid})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
