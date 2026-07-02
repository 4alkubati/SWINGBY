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
    return os.getenv("RESEND_FROM_EMAIL", "SwingBy <hello@swingbyy.com>")


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


def send_quote_received(
    to: str,
    first_name: str,
    post_title: str,
    business_name: str,
    quoted_price: float | None = None,
) -> None:
    price_line = (
        f"<li><strong>Quoted price:</strong> ${quoted_price:.2f}</li>"
        if quoted_price is not None
        else "<li><strong>Quoted price:</strong> see app</li>"
    )
    html = f"""
<p>Hi {first_name},</p>
<p>You just received a quote on <strong>{post_title}</strong>.</p>
<ul>
  <li><strong>From:</strong> {business_name}</li>
  {price_line}
</ul>
<p>Open SwingBy to compare quotes and accept the one you want.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, f"New quote on {post_title} — SwingBy", html)


def send_date_confirmed_business(
    to: str,
    business_name: str,
    booking_id: str,
    confirmed_date: str,
) -> None:
    html = f"""
<p>Hi {business_name},</p>
<p>The client confirmed a date for booking <strong>{booking_id}</strong>.</p>
<ul>
  <li><strong>Scheduled for:</strong> {confirmed_date}</li>
</ul>
<p>Make sure the assigned employee is ready. The job is now in progress.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "Booking date confirmed — SwingBy", html)


def send_booking_completed_client(
    to: str,
    first_name: str,
    booking_id: str,
    business_name: str,
) -> None:
    html = f"""
<p>Hi {first_name},</p>
<p>Your booking with <strong>{business_name}</strong> is marked <strong>complete</strong>. Full payment has been released.</p>
<ul>
  <li><strong>Booking ID:</strong> {booking_id}</li>
</ul>
<p><strong>Leave a review</strong> — it helps the next client choose the right business and rewards great workers.</p>
<p>Open SwingBy → My Jobs → this booking → Leave a review.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "Booking complete — leave a review on SwingBy", html)


def send_booking_cancelled(
    to: str,
    first_name: str,
    booking_id: str,
    penalty_amount: float = 0.0,
) -> None:
    penalty_line = (
        f"<li><strong>Penalty applied:</strong> ${penalty_amount:.2f}</li>"
        if penalty_amount and penalty_amount > 0
        else "<li><strong>Penalty applied:</strong> none</li>"
    )
    html = f"""
<p>Hi {first_name},</p>
<p>A booking you were part of has been <strong>cancelled</strong>.</p>
<ul>
  <li><strong>Booking ID:</strong> {booking_id}</li>
  {penalty_line}
</ul>
<p>If anything looks wrong, reply to this email and we'll take a look.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "Booking cancelled — SwingBy", html)


def send_payment_receipt(
    to: str,
    first_name: str,
    booking_id: str,
    amount_paid: float,
) -> None:
    html = f"""
<p>Hi {first_name},</p>
<p>Thanks — your payment cleared. This email is your receipt.</p>
<ul>
  <li><strong>Booking ID:</strong> {booking_id}</li>
  <li><strong>Amount paid:</strong> ${amount_paid:.2f} CAD</li>
</ul>
<p>Funds are held in escrow and released to the business as work is completed.</p>
<p>— The SwingBy Team</p>
"""
    send_email(to, "Payment received — SwingBy receipt", html)
