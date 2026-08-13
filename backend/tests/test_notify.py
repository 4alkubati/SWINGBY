"""Tests for tools/notify.py — the thing that talks to Telegram.

WHY THIS LIVES IN backend/tests
-------------------------------
CI runs exactly one Python command: `pytest backend/tests -q`
(.github/workflows/backend.yml). A test under `tools/` would never run. Same
reasoning as test_social_post.py, and the script is loaded by path for the same
reason: `tools/` is not a package.

What is worth pinning is everything that happens BEFORE the network — whether a
dry run can send, whether the token can escape into a log, and whether a long
message is split rather than truncated.
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "notify.py"

_spec = importlib.util.spec_from_file_location("notify", _SCRIPT)
notify = importlib.util.module_from_spec(_spec)
sys.modules["notify"] = notify
_spec.loader.exec_module(notify)


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(notify, "load_dotenv", lambda *a, **k: None)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "8123456789:AAHsecretsecretsecret")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "-1001234567890")


@pytest.fixture
def unconfigured(monkeypatch):
    monkeypatch.setattr(notify, "load_dotenv", lambda *a, **k: None)
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)


# ── the dry run must be a real dry run ───────────────────────────────────────


class TestDryRun:
    def test_default_does_not_send(self, configured, capsys):
        """The whole safety model is that the default is inert."""
        with patch.object(notify, "send_one") as sender:
            rc = notify.main(["hello"])
        assert rc == 0
        sender.assert_not_called()
        assert "DRY RUN" in capsys.readouterr().out

    def test_send_flag_sends(self, configured):
        with patch.object(notify, "send_one", return_value="42") as sender:
            rc = notify.main(["hello", "--send"])
        assert rc == 0
        sender.assert_called_once()
        assert sender.call_args[0][0] == "hello"

    def test_dry_run_works_even_unconfigured(self, unconfigured, capsys):
        """Composing a message must not require credentials — otherwise nobody
        can check the text before wiring the bot up."""
        with patch.object(notify, "send_one") as sender:
            rc = notify.main(["hello"])
        assert rc == 0
        sender.assert_not_called()
        assert "not configured" in capsys.readouterr().out

    def test_send_refuses_when_unconfigured(self, unconfigured):
        with patch.object(notify, "send_one") as sender:
            rc = notify.main(["hello", "--send"])
        assert rc == 1
        sender.assert_not_called()


# ── the token must never reach a terminal ────────────────────────────────────


class TestTokenNeverLeaks:
    def test_redact_removes_token_and_bot_id(self, configured):
        leaked = "POST https://api.telegram.org/bot8123456789:AAHsecretsecretsecret/sendMessage"
        out = notify.redact(leaked)
        assert "AAHsecretsecretsecret" not in out
        assert "8123456789" not in out

    def test_check_never_prints_the_whole_token(self, configured, capsys):
        rc = notify.main(["--check"])
        assert rc == 0
        out = capsys.readouterr().out
        assert "AAHsecretsecretsecret" not in out
        assert "cret" in out  # last 4 only, so you can tell WHICH token

    def test_http_error_detail_is_redacted(self, configured):
        """urllib puts the URL — and Telegram puts the token IN the URL — into
        the exception string. An unredacted raise leaks it into CI logs."""
        import urllib.error

        err = urllib.error.HTTPError(
            "https://api.telegram.org/bot8123456789:AAHsecretsecretsecret/sendMessage",
            403,
            "Forbidden",
            {},
            None,
        )
        with patch.object(notify.urllib.request, "urlopen", side_effect=err):
            with pytest.raises(RuntimeError) as caught:
                notify.send_one("hi")
        assert "AAHsecretsecretsecret" not in str(caught.value)
        assert "send your bot a message first" in str(caught.value)


# ── credential loading ───────────────────────────────────────────────────────


class TestCredentialLoading:
    def test_reads_the_shared_n8n_secrets(self, tmp_path, monkeypatch):
        """The bot already exists: .claude/secrets/n8n.env has been driving the
        n8n morning brief and sentinel.sh since 2026-07-14. Reading it is what
        stops the same credential living in two files and being rotated in one."""
        monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
        monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
        shared = tmp_path / "n8n.env"
        shared.write_text("TELEGRAM_BOT_TOKEN=from-n8n\nTELEGRAM_CHAT_ID=123\n")
        notify.load_dotenv((tmp_path / "nope.env", shared))
        assert notify.missing() == []

    def test_env_notify_wins_over_shared(self, tmp_path, monkeypatch):
        """First file read wins, so a dedicated bot can override the shared one."""
        monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
        monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
        first = tmp_path / ".env.notify"
        first.write_text("TELEGRAM_BOT_TOKEN=dedicated\nTELEGRAM_CHAT_ID=1\n")
        second = tmp_path / "n8n.env"
        second.write_text("TELEGRAM_BOT_TOKEN=shared\nTELEGRAM_CHAT_ID=2\n")
        notify.load_dotenv((first, second))
        import os

        assert os.environ["TELEGRAM_BOT_TOKEN"] == "dedicated"

    def test_does_not_import_unrelated_secrets(self, tmp_path, monkeypatch):
        """n8n.env also carries Discord, X, Meta and NVIDIA credentials. A
        notifier has no business pulling those into its process environment,
        where any subprocess it spawns would inherit them."""
        monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
        monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
        monkeypatch.delenv("DISCORD_BOT_TOKEN", raising=False)
        monkeypatch.delenv("X_API_KEY", raising=False)
        shared = tmp_path / "n8n.env"
        shared.write_text(
            "TELEGRAM_BOT_TOKEN=t\nTELEGRAM_CHAT_ID=1\n"
            "DISCORD_BOT_TOKEN=nope\nX_API_KEY=alsonope\n"
        )
        notify.load_dotenv((shared,))
        import os

        assert os.environ.get("DISCORD_BOT_TOKEN") is None
        assert os.environ.get("X_API_KEY") is None
        assert os.environ["TELEGRAM_BOT_TOKEN"] == "t"


# ── long messages are split, never truncated ─────────────────────────────────


class TestChunking:
    def test_short_message_is_one_chunk(self):
        assert notify.chunk("hello") == ["hello"]

    def test_empty_is_no_chunks(self):
        assert notify.chunk("   \n  ") == []

    def test_splits_on_line_boundaries(self):
        text = "\n".join(["x" * 100] * 60)  # ~6060 chars
        parts = notify.chunk(text)
        assert len(parts) > 1
        assert all(len(p) <= notify.LIMIT for p in parts)
        # nothing lost: every source line survives somewhere
        assert sum(p.count("x") for p in parts) == 6000

    def test_one_enormous_line_is_hard_split(self):
        parts = notify.chunk("y" * 10000)
        assert len(parts) == 3
        assert all(len(p) <= notify.LIMIT for p in parts)
        assert sum(len(p) for p in parts) == 10000

    def test_every_chunk_is_sent(self, configured):
        with patch.object(notify, "send_one", return_value="1") as sender:
            rc = notify.main(["\n".join(["z" * 100] * 60), "--send"])
        assert rc == 0
        assert sender.call_count == len(notify.chunk("\n".join(["z" * 100] * 60)))

    def test_partial_failure_reports_what_landed(self, configured, capsys):
        """Two land, the third fails — the operator must not rerun blindly.

        120 lines x 100 chars is deliberately over 3 x LIMIT: at 60 lines this
        only chunks into 2 and the failing side_effect never fires, which made
        an earlier version of this test pass for the wrong reason.
        """
        long_message = "\n".join(["w" * 100] * 120)
        assert len(notify.chunk(long_message)) >= 3  # the premise, pinned
        with patch.object(
            notify, "send_one", side_effect=["1", "2", RuntimeError("boom")]
        ):
            rc = notify.main([long_message, "--send"])
        assert rc == 1
        err = capsys.readouterr().err
        assert "FAILED on message 3" in err
        assert "2 message(s) already delivered" in err
