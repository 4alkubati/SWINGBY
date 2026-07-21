"""
email.py — best-effort Resend transactional email helper.

Same contract as push.py:
  - NEVER raises to caller
  - NEVER logs email body content
  - No-ops silently if RESEND_API_KEY is not set (key not yet wired in env)

Every outgoing email is built through `_layout()`, which wraps the content in
the SwingBy shell (logo, card, detail table, footer) and emits a plain-text
alternative alongside the HTML. All caller-supplied values are escaped at the
render boundary via `_esc()` — never interpolate a raw string into the
templates below, since business names and job titles are user-controlled.
"""

import logging
import os
from datetime import datetime
from html import escape as _html_escape
from html import unescape as _html_unescape

import httpx

logger = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


def _api_key() -> str:
    return os.getenv("RESEND_API_KEY", "")


def _from_addr() -> str:
    return os.getenv("RESEND_FROM_EMAIL", "SwingBy <hello@swingbyy.com>")


def _reply_to() -> str:
    """Where replies land. Empty until a monitored support@ mailbox exists."""
    return os.getenv("EMAIL_REPLY_TO", "")


def _app_url() -> str:
    return os.getenv("APP_BASE_URL", "https://swingbyy.com").rstrip("/")


# ── Formatting helpers ─────────────────────────────────────────────────────────


def _esc(value) -> str:
    """Escape any caller-supplied value for safe HTML interpolation."""
    if value is None:
        return ""
    return _html_escape(str(value), quote=True)


def _subject(value: str, limit: int = 160) -> str:
    """
    Sanitise a subject line.

    Job titles and business names reach the Subject header, so strip CR/LF and
    other control characters (header-injection defence) and keep it short
    enough that clients don't truncate mid-word.
    """
    flat = " ".join(str(value).split())
    if len(flat) > limit:
        flat = flat[: limit - 1].rstrip() + "…"
    return flat


def _money(amount) -> str:
    """Render a dollar figure as $1,234.56. Falls back to the raw value."""
    try:
        return f"${float(amount):,.2f}"
    except (TypeError, ValueError):
        return str(amount or "")


def _fmt_date(value) -> str:
    """
    Render an ISO-8601 string as 'Saturday, 26 July 2026 at 2:00 PM'.

    confirmed_date is a plain text column, so anything may arrive here — always
    fall back to the raw string rather than raising.
    """
    if not value:
        return ""
    raw = str(value)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw
    stamp = parsed.strftime("%A, %-d %B %Y")
    if parsed.hour or parsed.minute:
        stamp += parsed.strftime(" at %-I:%M %p")
    return stamp


# ── Layout ─────────────────────────────────────────────────────────────────────

_STYLE = """
body{margin:0;padding:0;background:#07080a;color:#F4F6FA;
 font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;}
.container{max-width:540px;margin:0 auto;padding:40px 24px;}
.logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#F4F6FA;
 text-decoration:none;display:block;margin-bottom:28px;}
.card{background:#0F1115;border:1px solid #1F232B;border-radius:16px;padding:34px 30px;}
h1{font-size:23px;font-weight:700;margin:0 0 14px;color:#F4F6FA;line-height:1.3;}
p{font-size:15px;line-height:1.65;color:#8B92A0;margin:0 0 18px;}
p strong{color:#F4F6FA;}
.btn{display:inline-block;background:#6E56F7;color:#F4F6FA !important;font-size:15px;
 font-weight:600;padding:14px 30px;border-radius:10px;text-decoration:none;}
table.detail{width:100%;border-collapse:collapse;margin:22px 0;border-top:1px solid #1F232B;}
table.detail td{padding:11px 0;font-size:14px;border-bottom:1px solid #1F232B;
 vertical-align:top;}
td.lbl{color:#8B92A0;width:46%;}
td.val{color:#F4F6FA;font-weight:600;text-align:right;}
.note{font-size:13px;color:#8B92A0;margin-top:22px;}
.footer{margin-top:32px;font-size:12px;color:#8B92A0;text-align:center;line-height:1.7;}
.footer a{color:#8878F9;text-decoration:none;}
.pre{display:none;font-size:1px;color:#07080a;max-height:0;overflow:hidden;}
@media (prefers-color-scheme: light){
 body{background:#f5f5f5;color:#1a1a1a;}
 .card{background:#fff;border-color:#e5e5e5;}
 .logo,h1{color:#1a1a1a;}
 p,td.lbl,.note{color:#555;}
 p strong,td.val{color:#1a1a1a;}
 table.detail,table.detail td{border-color:#e5e5e5;}
}
"""


def _layout(
    *,
    title: str,
    preheader: str,
    heading: str,
    paragraphs: list,
    details: list | None = None,
    cta_label: str = "",
    cta_path: str = "",
    note: str = "",
) -> str:
    """
    Build the full HTML email.

    `heading`, `paragraphs` and `note` may carry <strong> markup, so any data
    interpolated into them must already have passed through `_esc()`.
    """
    rows = ""
    for label, value in details or []:
        if value in (None, ""):
            continue
        rows += (
            f'<tr><td class="lbl">{_esc(label)}</td><td class="val">{value}</td></tr>'
        )
    table = f'<table class="detail">{rows}</table>' if rows else ""

    button = ""
    if cta_label and cta_path:
        button = (
            f'<a href="{_esc(_app_url() + cta_path)}" class="btn">{_esc(cta_label)}</a>'
        )

    body = "".join(f"<p>{p}</p>" for p in paragraphs)
    note_html = f'<p class="note">{note}</p>' if note else ""

    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>{_esc(title)}</title>
<style>{_STYLE}</style>
</head><body>
<span class="pre">{_esc(preheader)}</span>
<div class="container">
  <a href="{_esc(_app_url())}" class="logo">SwingBy</a>
  <div class="card">
    <h1>{heading}</h1>
    {body}
    {table}
    {button}
    {note_html}
  </div>
  <div class="footer">
    <p>SwingBy &bull; Calgary, AB, Canada</p>
    <p><a href="{_esc(_app_url())}/privacy">Privacy</a> &bull;
       <a href="{_esc(_app_url())}/terms">Terms</a> &bull;
       <a href="{_esc(_app_url())}/help">Help</a></p>
  </div>
</div>
</body></html>"""


def _strip_tags(value: str) -> str:
    """Crude tag strip for the plain-text alternative."""
    out, skip = [], False
    for ch in str(value):
        if ch == "<":
            skip = True
        elif ch == ">":
            skip = False
        elif not skip:
            out.append(ch)
    return _html_unescape("".join(out))


def _plain(
    *,
    heading: str,
    paragraphs: list,
    details: list | None = None,
    cta_label: str = "",
    cta_path: str = "",
    note: str = "",
) -> str:
    """Plain-text alternative. HTML-only mail is a real deliverability penalty."""
    parts = [_strip_tags(heading), ""]
    parts += [_strip_tags(p) for p in paragraphs]
    detail_lines = [
        f"{label}: {_strip_tags(value)}"
        for label, value in (details or [])
        if value not in (None, "")
    ]
    if detail_lines:
        parts += [""] + detail_lines
    if cta_label and cta_path:
        parts += ["", f"{_strip_tags(cta_label)}: {_app_url()}{cta_path}"]
    if note:
        parts += ["", _strip_tags(note)]
    parts += ["", "— The SwingBy Team", f"Calgary, AB, Canada · {_app_url()}/help"]
    return "\n".join(parts)


def _compose(**kwargs) -> tuple:
    """Render one email spec to (html, text)."""
    return _layout(**kwargs), _plain(
        heading=kwargs["heading"],
        paragraphs=kwargs["paragraphs"],
        details=kwargs.get("details"),
        cta_label=kwargs.get("cta_label", ""),
        cta_path=kwargs.get("cta_path", ""),
        note=kwargs.get("note", ""),
    )


# ── Transport ──────────────────────────────────────────────────────────────────


def send_email(to: str, subject: str, html: str, text: str = "") -> None:
    """Send one transactional email via Resend. Best-effort — never raises."""
    key = _api_key()
    if not key:
        logger.debug("email.send skipped — RESEND_API_KEY not set to=%s", to)
        return
    try:
        payload = {
            "from": _from_addr(),
            "to": [to],
            "subject": _subject(subject),
            "html": html,
        }
        if text:
            payload["text"] = text
        reply_to = _reply_to()
        if reply_to:
            payload["reply_to"] = reply_to

        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {key}"},
                json=payload,
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


def send_welcome_email(to: str, first_name: str, role: str = "client") -> None:
    """
    Welcome mail, split by role. Telling a business owner to "post your first
    job" is the fastest way to look like nobody read who signed up.
    """
    name = _esc(first_name)

    if role in ("business_owner", "employee"):
        html_body, text_body = _compose(
            title="Welcome to SwingBy",
            preheader="Set your profile up so clients can find you and you can start quoting.",
            heading=f"Welcome to SwingBy, {name}.",
            paragraphs=[
                "Your business account is live. Clients across Calgary post jobs "
                "every day — here's how to start winning them.",
                "<strong>1. Finish your profile.</strong> Add your categories, "
                "service area and photos of past work. Clients skip businesses "
                "with empty profiles.",
                "<strong>2. Get verified.</strong> Upload your licence and our team "
                "reviews it by hand. Verified businesses win quotes more easily "
                "because clients trust them faster.",
                "<strong>3. Quote quickly.</strong> You'll be notified when a job "
                "matches your categories. The first credible quote usually wins.",
            ],
            cta_label="Complete your profile",
            cta_path="/app/business/profile",
            note="You keep 90% of every job. SwingBy takes 10%, deducted "
            "automatically when payment is released — no monthly fee, and quoting "
            "is always free.",
        )
        subject = "Welcome to SwingBy — let's get you your first job"
    else:
        html_body, text_body = _compose(
            title="Welcome to SwingBy",
            preheader="You're in. Here's how to get your first job done.",
            heading=f"Welcome to SwingBy, {name}.",
            paragraphs=[
                "SwingBy is the simplest way to find trusted local service "
                "businesses in Calgary. Here's how it works.",
                "<strong>1. Post what you need.</strong> Describe the job, set a "
                "rough budget, pick your area. Takes about two minutes, and it's free.",
                "<strong>2. Compare quotes.</strong> Local businesses reply with "
                "their price and timeline. Nobody can contact you until you accept "
                "one — so no cold calls.",
                "<strong>3. Book with your money protected.</strong> Payment is held "
                "in escrow and released only as the work gets done.",
            ],
            cta_label="Post your first job",
            cta_path="/app/post",
            note="Posting is free and you're never obligated to accept a quote.",
        )
        subject = f"Welcome to SwingBy, {first_name}"

    send_email(to, subject, html_body, text_body)


def send_quote_received(
    to: str,
    first_name: str,
    post_title: str,
    business_name: str,
    quoted_price: float | None = None,
) -> None:
    html_body, text_body = _compose(
        title="You have a new quote",
        preheader=f"{business_name} quoted on {post_title}.",
        heading="You've got a new quote.",
        paragraphs=[
            f"Hi {_esc(first_name)} — <strong>{_esc(business_name)}</strong> just "
            "quoted on your job.",
            "Compare it against your other quotes before deciding. Once you accept, "
            "the business can message you and the booking is created.",
        ],
        details=[
            ("Job", _esc(post_title)),
            ("Business", _esc(business_name)),
            (
                "Quoted price",
                _money(quoted_price) if quoted_price is not None else "See app",
            ),
        ],
        cta_label="Compare your quotes",
        cta_path="/app/my-posts",
        note="Quotes expire when your job post does — 7 days after posting.",
    )
    send_email(
        to, f"New quote on “{post_title}” from {business_name}", html_body, text_body
    )


def send_booking_confirmed_client(
    to: str,
    first_name: str,
    booking_id: str,
    total_amount: float,
    business_name: str = "",
    service_title: str = "",
    confirmed_date: str = "",
) -> None:
    """Client booking confirmation, with the full money and schedule picture."""
    try:
        half = round(float(total_amount) * 0.50, 2)
    except (TypeError, ValueError):
        half = None

    when = _fmt_date(confirmed_date)
    if when:
        next_step = (
            f"Your job is scheduled for <strong>{_esc(when)}</strong>. The business "
            "will assign the employee attending and you'll see live status updates "
            "on the day."
        )
    else:
        next_step = (
            "Next, the business assigns an employee and proposes dates for you to "
            "choose from. You'll get an email the moment they do."
        )

    html_body, text_body = _compose(
        title="Your booking is confirmed",
        preheader=f"Booking confirmed with {business_name or 'your chosen business'}.",
        heading="Your booking is confirmed.",
        paragraphs=[
            f"Hi {_esc(first_name)} — you accepted the quote, so this booking is "
            "now live.",
            next_step,
        ],
        details=[
            ("Service", _esc(service_title)),
            ("Business", _esc(business_name)),
            ("Scheduled for", _esc(when) if when else "To be confirmed"),
            ("Total", _money(total_amount)),
            ("Released now", _money(half) if half is not None else ""),
            ("Released on completion", _money(half) if half is not None else ""),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="View your booking",
        cta_path="/app/bookings",
        note="Half of your payment is released to the business on confirmation and "
        "the rest once the job is marked complete. Cancelling more than 48 hours "
        "before the scheduled date carries a 25% fee; within 48 hours it's 50%.",
    )
    send_email(to, "Your SwingBy booking is confirmed", html_body, text_body)


def send_booking_confirmed_business(
    to: str,
    business_name: str,
    booking_id: str,
    total_amount: float,
    client_name: str = "",
    service_title: str = "",
    confirmed_date: str = "",
) -> None:
    """Business booking confirmation — leads with the payout, then the next action."""
    try:
        payout = round(float(total_amount) * 0.90, 2)
        fee = round(float(total_amount) * 0.10, 2)
    except (TypeError, ValueError):
        payout = fee = None

    when = _fmt_date(confirmed_date)
    if when:
        next_step = (
            f"The client already set the date: <strong>{_esc(when)}</strong>. Assign "
            "the employee attending so the client knows who's coming."
        )
    else:
        next_step = (
            "Assign an employee and propose up to three dates. The client picks one "
            "and the job is locked in."
        )

    html_body, text_body = _compose(
        title="Your quote was accepted",
        preheader="Your quote was accepted — here's what to do next.",
        heading="Your quote was accepted.",
        paragraphs=[
            f"Good news, {_esc(business_name)} — "
            f"{_esc(client_name) if client_name else 'a client'} accepted your quote "
            "and the booking is confirmed.",
            next_step,
        ],
        details=[
            ("Service", _esc(service_title)),
            ("Client", _esc(client_name)),
            ("Scheduled for", _esc(when) if when else "Awaiting date"),
            ("Job total", _money(total_amount)),
            ("SwingBy fee (10%)", f"−{_money(fee)}" if fee is not None else ""),
            ("Your payout", _money(payout) if payout is not None else ""),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="Assign an employee",
        cta_path="/app/business/bookings",
        note="Half your payout is released on confirmation, the rest once the job "
        "is marked complete.",
    )
    send_email(to, "Your quote was accepted — new booking", html_body, text_body)


def send_date_confirmed_business(
    to: str,
    business_name: str,
    booking_id: str,
    confirmed_date: str,
    client_name: str = "",
    service_title: str = "",
) -> None:
    when = _fmt_date(confirmed_date)
    html_body, text_body = _compose(
        title="Booking date confirmed",
        preheader=f"The client confirmed {when or 'a date'} for this job.",
        heading="The date is confirmed.",
        paragraphs=[
            f"{_esc(business_name)} — the client confirmed a date, so this job is "
            "locked in and now in progress.",
            "Make sure the assigned employee has the address and the time. You can "
            "keep the client updated from the job's live status timeline.",
        ],
        details=[
            ("Service", _esc(service_title)),
            ("Client", _esc(client_name)),
            ("Scheduled for", _esc(when)),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="Open the job",
        cta_path="/app/business/bookings",
        note="Cancelling within 48 hours of the scheduled date carries a 50% penalty.",
    )
    send_email(to, f"Date confirmed — {when or 'your booking'}", html_body, text_body)


def send_booking_completed_client(
    to: str,
    first_name: str,
    booking_id: str,
    business_name: str,
    service_title: str = "",
    total_amount: float | None = None,
) -> None:
    html_body, text_body = _compose(
        title="Your booking is complete",
        preheader=f"How did {business_name} do? Leave a review.",
        heading="That's a wrap.",
        paragraphs=[
            f"Hi {_esc(first_name)} — your job with "
            f"<strong>{_esc(business_name)}</strong> is marked complete, and the "
            "remaining payment has been released to them.",
            "<strong>Please leave a review.</strong> It takes about thirty seconds "
            "and it's the most useful thing you can do here — it helps the next "
            "client choose well and rewards businesses who did good work.",
        ],
        details=[
            ("Service", _esc(service_title)),
            ("Business", _esc(business_name)),
            ("Total paid", _money(total_amount) if total_amount is not None else ""),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="Leave a review",
        cta_path="/app/bookings",
        note="Something not right? Reply to this email and we'll look into it.",
    )
    send_email(
        to, f"Your booking with {business_name} is complete", html_body, text_body
    )


def send_booking_cancelled(
    to: str,
    first_name: str,
    booking_id: str,
    penalty_amount: float = 0.0,
    service_title: str = "",
    reason: str = "",
    cancelled_by_you: bool = False,
) -> None:
    has_penalty = bool(penalty_amount and penalty_amount > 0)

    if cancelled_by_you:
        opener = "you cancelled this booking. Here's the summary for your records."
    else:
        opener = (
            "the other party cancelled this booking. Nothing further is needed "
            "from you."
        )

    paragraphs = [f"Hi {_esc(first_name)} — {opener}"]
    if has_penalty:
        paragraphs.append(
            "A cancellation fee applies under the booking terms: 25% when cancelled "
            "more than 48 hours before the scheduled date, 50% within 48 hours."
        )
    else:
        paragraphs.append("No cancellation fee was applied to this booking.")

    html_body, text_body = _compose(
        title="Booking cancelled",
        preheader="This booking has been cancelled.",
        heading="This booking was cancelled.",
        paragraphs=paragraphs,
        details=[
            ("Service", _esc(service_title)),
            ("Reason", _esc(reason)),
            ("Cancellation fee", _money(penalty_amount) if has_penalty else "None"),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="View your bookings",
        cta_path="/app/bookings",
        note="Any refund owed to you goes back to your original payment method and "
        "usually lands within 5–10 business days. If something looks wrong, reply "
        "to this email and we'll take a look.",
    )
    send_email(to, "Your SwingBy booking was cancelled", html_body, text_body)


def send_payment_receipt(
    to: str,
    first_name: str,
    booking_id: str,
    amount_paid: float,
    business_name: str = "",
    service_title: str = "",
) -> None:
    paid_on = datetime.now().strftime("%-d %B %Y")
    html_body, text_body = _compose(
        title="Payment receipt",
        preheader=f"Receipt for {_money(amount_paid)} — keep this for your records.",
        heading="Payment received.",
        paragraphs=[
            f"Thanks, {_esc(first_name)} — your payment cleared. This email is your "
            "receipt.",
            "Your money is held in escrow rather than passed straight to the "
            "business. Half is released when the booking is confirmed, the rest "
            "once the job is marked complete.",
        ],
        details=[
            ("Amount paid", f"{_money(amount_paid)} CAD"),
            ("Date", _esc(paid_on)),
            ("Service", _esc(service_title)),
            ("Business", _esc(business_name)),
            ("Reference", _esc(booking_id)),
        ],
        cta_label="View your booking",
        cta_path="/app/bookings",
        note="Need a formal invoice? You can download one from the booking in the app.",
    )
    send_email(
        to, f"Receipt — {_money(amount_paid)} paid to SwingBy", html_body, text_body
    )
