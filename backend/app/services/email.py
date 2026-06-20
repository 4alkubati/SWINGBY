"""
email.py — best-effort Resend transactional email helper.

Same contract as push.py:
  - NEVER raises to caller
  - NEVER logs email body content
  - No-ops silently if RESEND_API_KEY is not set (key not yet wired in env)
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


def _api_key() -> str:
    return os.getenv("RESEND_API_KEY", "")


def _from_addr() -> str:
    return os.getenv("RESEND_FROM_EMAIL", "SwingBy <hello@swingby.ca>")


def send_email(to: str, subject: str, html: str) -> None:
    """Send one transactional email via Resend. Best-effort — never raises."""
    key = _api_key()
    if not key:
        logger.debug("email.send skipped — RESEND_API_KEY not set to=%s", to)
        return
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "from": _from_addr(),
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            if resp.status_code >= 400:
                logger.warning(
                    "email.send failed status=%s to=%s subject=%r",
                    resp.status_code,
                    to,
                    subject,
                )
    except Exception as err:
        logger.warning("email.send error to=%s err=%s", to, str(err)[:120])


# ── Named templates ────────────────────────────────────────────────────────────

def send_welcome_email(to: str, first_name: str) -> None:
    html = f"""
<p>Hey {first_name},</p>
<p>Welcome to <strong>SwingBy</strong> — Calgary's service marketplace.</p>
<p>You can now browse nearby service providers or post your first job and receive quotes.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, f"Welcome to SwingBy, {first_name}!", html)


def send_booking_confirmed_client(
    to: str,
    first_name: str,
    booking_id: str,
    total_amount: float,
) -> None:
    html = f"""
<p>Hi {first_name},</p>
<p>Your booking has been <strong>confirmed</strong>.</p>
<ul>
  <li><strong>Booking ID:</strong> {booking_id}</li>
  <li><strong>Total:</strong> ${total_amount:.2f}</li>
</ul>
<p>The business will assign an employee and propose available dates shortly.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "Your booking is confirmed — SwingBy", html)


def send_booking_confirmed_business(
    to: str,
    business_name: str,
    booking_id: str,
    total_amount: float,
) -> None:
    html = f"""
<p>Hi {business_name},</p>
<p>A client accepted your quote — you have a new <strong>confirmed booking</strong>.</p>
<ul>
  <li><strong>Booking ID:</strong> {booking_id}</li>
  <li><strong>Total:</strong> ${total_amount:.2f}</li>
</ul>
<p>Log in to assign an employee and propose available dates.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "New booking confirmed — SwingBy", html)
