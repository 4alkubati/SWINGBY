"""
notion_crm.py — Best-effort sync of new signups to the Notion CRM database.

Never raises; failures are logged at WARNING level without leaking PII or tokens.
"""

from datetime import datetime, timezone
import structlog
import httpx

from app.config import settings

logger = structlog.get_logger(__name__)

_NOTION_API = "https://api.notion.com/v1/pages"
_NOTION_VERSION = "2022-06-28"


def sync_user_to_crm(
    user_id: str,
    email: str,
    first_name: str,
    last_name: str,
    role: str,
    source: str = "app_signup",
) -> None:
    """
    Push a newly registered user into the Notion CRM database.
    Best-effort: any exception is swallowed after logging.
    """
    if not settings.NOTION_TOKEN:
        return

    try:
        display_name = f"{first_name} {last_name}".strip() or email
        now_iso = datetime.now(timezone.utc).isoformat()

        headers = {
            "Authorization": f"Bearer {settings.NOTION_TOKEN}",
            "Notion-Version": _NOTION_VERSION,
            "Content-Type": "application/json",
        }
        payload = {
            "parent": {"database_id": settings.NOTION_CRM_DB_ID},
            "properties": {
                "Name": {
                    "title": [{"text": {"content": display_name}}]
                },
                "Email": {
                    "email": email
                },
                "Source": {
                    "rich_text": [{"text": {"content": source}}]
                },
                "Date": {
                    "date": {"start": now_iso}
                },
            },
        }

        with httpx.Client(timeout=5.0) as client:
            client.post(_NOTION_API, headers=headers, json=payload)

    except Exception as exc:
        short_err = str(exc)[:120]
        logger.warning(
            "notion_crm_sync_failed",
            user=user_id,
            err=short_err,
        )
