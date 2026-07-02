"""
push.py — best-effort Expo Push Notification helper.

Rules:
  - NEVER raise to caller (best-effort only)
  - NEVER log token values
  - Uses service-role supabase client to query push_tokens
"""

import logging

import httpx

from app.supabase_client import supabase

logger = logging.getLogger(__name__)

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    """
    Send an Expo push notification to every registered token for user_id.

    Best-effort: swallows all exceptions. Token values are never logged.
    """
    try:
        tokens_res = (
            supabase.table("push_tokens")
            .select("token, platform")
            .eq("user_id", user_id)
            .execute()
        )
        rows = tokens_res.data or []

        if not rows:
            return

        payload_data = data or {}

        with httpx.Client(timeout=5.0) as client:
            for row in rows:
                token = row["token"]
                try:
                    client.post(
                        _EXPO_PUSH_URL,
                        json={
                            "to": token,
                            "title": title,
                            "body": body,
                            "data": payload_data,
                            "sound": "default",
                        },
                    )
                except Exception as inner_err:
                    # Log user id only — never log the token value
                    logger.warning(
                        "push_failed user=%s err=%s",
                        user_id,
                        str(inner_err)[:120],
                    )

    except Exception as err:
        logger.warning("push_failed user=%s err=%s", user_id, str(err)[:120])
