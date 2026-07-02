"""
contact.py — Public contact-form endpoint.

Forwards the submitted message to the SwingBy team inbox via Resend.
Rate-limited to prevent spam. Always returns 200 to avoid leaking
configuration state (e.g. whether email delivery is wired).
"""

import html
import os

import structlog
from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr, Field

from app.limiter import limiter
from app.services.email import send_email

logger = structlog.get_logger(__name__)

router = APIRouter()


_TOPICS = {"general", "support", "business", "press", "feedback"}


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr = Field(..., max_length=320)
    topic: str = Field(..., max_length=40)
    message: str = Field(..., min_length=4, max_length=4000)


def _inbox() -> str:
    return os.getenv("CONTACT_INBOX_EMAIL", "hello@swingbyy.com")


@router.post("/")
@limiter.limit("5/minute")
def submit_contact_form(request: Request, data: ContactRequest):
    topic = data.topic.lower() if data.topic else "general"
    if topic not in _TOPICS:
        topic = "general"

    safe_name = html.escape(data.name.strip())
    safe_email = html.escape(str(data.email))
    safe_msg = html.escape(data.message.strip()).replace("\n", "<br/>")

    body = (
        f"<p><strong>From:</strong> {safe_name} &lt;{safe_email}&gt;</p>"
        f"<p><strong>Topic:</strong> {topic}</p>"
        f"<hr/>"
        f"<p>{safe_msg}</p>"
    )

    # Best-effort: never raises, no-ops cleanly if Resend not yet wired.
    send_email(
        to=_inbox(),
        subject=f"[Contact · {topic}] {safe_name}",
        html=body,
    )
    logger.info("contact.submit", topic=topic, name_len=len(data.name))
    return {"message": "Thanks — we'll get back to you within one business day."}
