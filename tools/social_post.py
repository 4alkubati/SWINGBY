#!/usr/bin/env python3
"""social_post.py — one post, every platform, one command.

    python tools/social_post.py --list
    python tools/social_post.py launch-2026-08-01              # DRY RUN
    python tools/social_post.py launch-2026-08-01 --publish    # actually posts

WHY THIS AND NOT THE n8n WORKFLOW
---------------------------------
`marketing/11-n8n-social-workflow.md` describes three workflows, 43 nodes, and
credentials for Notion, OpenAI, Slack, Buffer and every network — and its own
first paragraph says "all workflows use placeholder credentials. Activate only
after completing Phase 2 setup." It has never posted anything. It is the same
shape as every other defect this repo keeps finding: complete, reviewed, and
connected to nothing.

Two posts do not need an approval gate, a GPT caption writer, or a Notion
database. They need credentials and a POST. This script is the smallest thing
that can actually publish, and n8n can still drive it later — one Execute
Command node — if the visible-workflow version is wanted. Nothing here blocks
that; it just refuses to wait for it.

DESIGN
------
* **Dry run by default.** Publishing is irreversible and public. `--publish` is
  the only way to send anything, and the dry run prints exactly what would go
  where, including the character count against each platform's limit.
* **Missing credentials are SKIPPED, loudly, and are not failures.** Kira will
  have Instagram before X. A run that posts to what exists and names what it
  could not reach beats one that refuses to do anything until everything is
  configured.
* **Per-platform isolation.** One network being down or one token being expired
  must not stop the others. Every send is independent, and the summary at the
  end is the truth.
* **No secrets in this file, ever.** Everything comes from the environment (or a
  local `.env` this reads if present). See `CREDENTIALS` for the exact names.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

try:
    import httpx
except ImportError:  # pragma: no cover - the script is useless without it
    print("social_post: needs httpx  →  pip install httpx", file=sys.stderr)
    raise SystemExit(2)

REPO = Path(__file__).resolve().parent.parent
POSTS_FILE = REPO / "marketing" / "content-library" / "launch-post-2026-08.md"

# Exactly which environment variables each platform needs. Printed by --check so
# the answer to "what do I still have to set up" is one command, not a doc.
CREDENTIALS = {
    "instagram": ["IG_USER_ID", "META_ACCESS_TOKEN"],
    "facebook": ["FB_PAGE_ID", "META_ACCESS_TOKEN"],
    "x": ["X_BEARER_TOKEN"],
    "linkedin": ["LINKEDIN_URN", "LINKEDIN_ACCESS_TOKEN"],
}

# Hard platform limits. X is the only one that will reject on length, but the
# others get counted too so nothing goes out visibly truncated by the network.
LIMITS = {"instagram": 2200, "facebook": 63206, "x": 280, "linkedin": 3000}


@dataclass
class Post:
    """One post, in its long and short forms."""

    post_id: str
    title: str
    long_form: str
    short_form: str
    hashtags: str = ""

    def text_for(self, platform: str) -> str:
        if platform == "x":
            return self.short_form
        body = self.long_form
        if self.hashtags and platform in ("instagram", "facebook"):
            body = f"{body}\n\n{self.hashtags}"
        return body


@dataclass
class Result:
    platform: str
    ok: bool
    detail: str
    skipped: bool = False


@dataclass
class Sender:
    name: str
    send: Callable[[str, Optional[str]], str]
    needs_image: bool = False
    env: list = field(default_factory=list)


# ── Parsing the post file ────────────────────────────────────────────────────
# The markdown IS the source. A separate machine-readable copy would drift from
# the one a human edits, and the human copy is the one that gets proofread.


def _fenced_blocks(section: str) -> list:
    return [b.strip() for b in re.findall(r"```(?:\w+)?\n(.*?)```", section, re.S)]


def load_posts(path: Path = POSTS_FILE) -> dict:
    if not path.exists():
        raise SystemExit(f"social_post: no post file at {path}")

    text = path.read_text(encoding="utf-8")
    posts = {}

    # Split on the POST headings, keeping each heading with its body.
    chunks = re.split(r"\n## POST \d+ — ", text)[1:]
    for chunk in chunks:
        title = chunk.splitlines()[0].strip()
        m = re.search(r"\*\*id:\*\*\s*`([^`]+)`", chunk)
        if not m:
            continue
        post_id = m.group(1)

        blocks = _fenced_blocks(chunk)
        if len(blocks) < 2:
            continue

        tags = re.search(r"\*\*Hashtags[^:]*:\*\*\s*`([^`]+)`", chunk)
        posts[post_id] = Post(
            post_id=post_id,
            title=title,
            long_form=blocks[0],
            short_form=blocks[1],
            hashtags=tags.group(1).strip() if tags else "",
        )

    if not posts:
        raise SystemExit(f"social_post: found no posts in {path}")
    return posts


def load_dotenv(path: Path = REPO / ".env.social") -> None:
    """Read a local .env.social if present. Never committed — see .gitignore."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def configured(platform: str) -> bool:
    return all(os.environ.get(k) for k in CREDENTIALS[platform])


def missing(platform: str) -> list:
    return [k for k in CREDENTIALS[platform] if not os.environ.get(k)]


# ── The senders ──────────────────────────────────────────────────────────────
# Each returns a human-readable id/url on success and raises on failure. None of
# them retries: a retry on a POST that may already have landed is how a launch
# post goes out twice.

TIMEOUT = 20.0


def send_instagram(text: str, image_url: Optional[str]) -> str:
    """Graph API, two steps: create a media container, then publish it.

    Instagram has no text-only post. Without an image this raises rather than
    reporting a success that did not happen.
    """
    if not image_url:
        raise RuntimeError("Instagram needs an image (set SOCIAL_IMAGE_URL)")

    user_id = os.environ["IG_USER_ID"]
    token = os.environ["META_ACCESS_TOKEN"]

    with httpx.Client(timeout=TIMEOUT) as client:
        create = client.post(
            f"https://graph.facebook.com/v21.0/{user_id}/media",
            data={"image_url": image_url, "caption": text, "access_token": token},
        )
        create.raise_for_status()
        container = create.json()["id"]

        publish = client.post(
            f"https://graph.facebook.com/v21.0/{user_id}/media_publish",
            data={"creation_id": container, "access_token": token},
        )
        publish.raise_for_status()
        return f"ig media {publish.json().get('id')}"


def send_facebook(text: str, image_url: Optional[str]) -> str:
    page_id = os.environ["FB_PAGE_ID"]
    token = os.environ["META_ACCESS_TOKEN"]

    with httpx.Client(timeout=TIMEOUT) as client:
        if image_url:
            res = client.post(
                f"https://graph.facebook.com/v21.0/{page_id}/photos",
                data={"url": image_url, "caption": text, "access_token": token},
            )
        else:
            res = client.post(
                f"https://graph.facebook.com/v21.0/{page_id}/feed",
                data={"message": text, "access_token": token},
            )
        res.raise_for_status()
        return f"fb post {res.json().get('id') or res.json().get('post_id')}"


def send_x(text: str, image_url: Optional[str]) -> str:
    """POST /2/tweets. Image upload needs the v1.1 media endpoint and OAuth1,
    which is a different auth story — text only here, deliberately."""
    token = os.environ["X_BEARER_TOKEN"]
    with httpx.Client(timeout=TIMEOUT) as client:
        res = client.post(
            "https://api.twitter.com/2/tweets",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": text},
        )
        res.raise_for_status()
        return f"x tweet {res.json().get('data', {}).get('id')}"


def send_linkedin(text: str, image_url: Optional[str]) -> str:
    urn = os.environ["LINKEDIN_URN"]  # e.g. urn:li:organization:12345
    token = os.environ["LINKEDIN_ACCESS_TOKEN"]
    payload = {
        "author": urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    with httpx.Client(timeout=TIMEOUT) as client:
        res = client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            json=payload,
        )
        res.raise_for_status()
        return f"li {res.headers.get('x-restli-id', 'posted')}"


SENDERS = {
    "instagram": Sender("instagram", send_instagram, needs_image=True),
    "facebook": Sender("facebook", send_facebook),
    "x": Sender("x", send_x),
    "linkedin": Sender("linkedin", send_linkedin),
}


def publish(post: Post, platforms: list, image_url: Optional[str], live: bool) -> list:
    """Send `post` to each platform. Never raises — every outcome is a Result."""
    results = []
    for name in platforms:
        sender = SENDERS[name]
        text = post.text_for(name)
        limit = LIMITS[name]

        if not configured(name):
            results.append(
                Result(name, False, f"not configured — set {', '.join(missing(name))}", skipped=True)
            )
            continue

        if len(text) > limit:
            results.append(
                Result(name, False, f"{len(text)} chars over the {limit} limit — edit the post")
            )
            continue

        if sender.needs_image and not image_url:
            results.append(
                Result(name, False, "needs an image — set SOCIAL_IMAGE_URL", skipped=True)
            )
            continue

        if not live:
            results.append(Result(name, True, f"DRY RUN — {len(text)}/{limit} chars"))
            continue

        try:
            results.append(Result(name, True, sender.send(text, image_url)))
        except Exception as exc:  # one network's failure is not the others'
            detail = str(exc)
            if isinstance(exc, httpx.HTTPStatusError):
                detail = f"{exc.response.status_code} {exc.response.text[:200]}"
            results.append(Result(name, False, detail))
    return results


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Post to every social platform at once.")
    parser.add_argument("post_id", nargs="?", help="id from the post file")
    parser.add_argument("--publish", action="store_true", help="actually send (default is a dry run)")
    parser.add_argument("--list", action="store_true", help="list available posts")
    parser.add_argument("--check", action="store_true", help="show which platforms are configured")
    parser.add_argument("--only", help="comma-separated platforms (default: all)")
    parser.add_argument("--json", action="store_true", help="machine-readable summary (for n8n)")
    args = parser.parse_args(argv)

    load_dotenv()
    posts = load_posts()

    if args.list:
        for p in posts.values():
            print(f"{p.post_id}\t{p.title}")
        return 0

    if args.check:
        for name in SENDERS:
            gaps = missing(name)
            print(f"{name:10} {'ready' if not gaps else 'missing ' + ', '.join(gaps)}")
        img = os.environ.get("SOCIAL_IMAGE_URL")
        print(f"{'image':10} {img or 'not set — Instagram will be skipped'}")
        return 0

    if not args.post_id:
        parser.error("give a post id, or use --list")
    if args.post_id not in posts:
        parser.error(f"unknown post {args.post_id!r}. --list shows the ids.")

    platforms = (
        [p.strip() for p in args.only.split(",")] if args.only else list(SENDERS)
    )
    unknown = [p for p in platforms if p not in SENDERS]
    if unknown:
        parser.error(f"unknown platform(s): {', '.join(unknown)}")

    post = posts[args.post_id]
    image_url = os.environ.get("SOCIAL_IMAGE_URL")
    results = publish(post, platforms, image_url, live=args.publish)

    if args.json:
        print(json.dumps([r.__dict__ for r in results], indent=2))
    else:
        header = "PUBLISHED" if args.publish else "DRY RUN (nothing was sent)"
        print(f"\n{header} — {post.post_id}: {post.title}\n")
        for r in results:
            mark = "·" if r.skipped else ("✓" if r.ok else "✗")
            print(f"  {mark} {r.platform:10} {r.detail}")
        sent = sum(1 for r in results if r.ok and not r.skipped)
        failed = [r for r in results if not r.ok and not r.skipped]
        print(f"\n{sent} sent, {len(failed)} failed, "
              f"{sum(1 for r in results if r.skipped)} skipped")
        if not args.publish:
            print("\nAdd --publish to send it for real.")

    # Non-zero only on a REAL failure. Nothing configured yet is not a failure.
    return 1 if any(not r.ok and not r.skipped for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
