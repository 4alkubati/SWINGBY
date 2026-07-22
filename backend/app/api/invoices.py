"""
invoices.py — D2.2. Invoice JSON + PDF for a completed booking.

Endpoints
---------
GET /bookings/{booking_id}/invoice
    Auth: booking client OR business owner.
    Returns invoice JSON (line items, totals, parties, payment).

GET /bookings/{booking_id}/invoice.pdf
    Same auth. Returns a rendered PDF (reportlab). iOS Safari opens inline.
"""

from __future__ import annotations

import io
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


def _load_invoice_data(booking_id: str, current_user: dict) -> dict:
    """Fetch booking + related parties and shape the invoice payload."""
    booking_res = (
        supabase.table("bookings")
        .select(
            "id, client_id, business_id, employee_id, service_category, total_amount, "
            "platform_fee, commission_rate, status, payment_status, "
            "confirmed_date, created_at, "
            "businesses(business_name, category, license_status), "
            "employees(role_title, users(first_name, last_name))"
        )
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    uid = current_user["id"]
    role = current_user["role"]
    is_client = booking["client_id"] == uid
    is_business_owner = False
    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("owner_id")
            .eq("id", booking["business_id"])
            .single()
            .execute()
        )
        is_business_owner = bool(biz.data) and biz.data["owner_id"] == uid
    if not (is_client or is_business_owner):
        raise HTTPException(status_code=403, detail="Not your invoice")

    client_res = (
        supabase.table("users")
        .select("first_name, last_name, email")
        .eq("id", booking["client_id"])
        .single()
        .execute()
    )
    client = client_res.data or {}

    pay_res = (
        supabase.table("payments")
        .select(
            "status, method, stripe_payment_intent_id, "
            "total_charged, platform_cut, released_to_business"
        )
        .eq("booking_id", booking_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    payment = (pay_res.data or [{}])[0]

    total_amount = float(booking.get("total_amount") or 0)
    platform_cut = float(booking.get("platform_fee") or round(total_amount * 0.10, 2))
    to_business = round(total_amount - platform_cut, 2)

    biz = booking.get("businesses") or {}
    emp = booking.get("employees") or {}
    emp_user = (emp.get("users") or {}) if isinstance(emp, dict) else {}

    return {
        "invoice_number": f"SWB-{booking['id'][:8].upper()}",
        "issued_at": (booking.get("completed_at") or booking.get("created_at")),
        "booking_id": booking["id"],
        "client": {
            "name": " ".join(
                x for x in [client.get("first_name"), client.get("last_name")] if x
            ).strip()
            or "Client",
            "email": client.get("email"),
        },
        "business": {
            "name": biz.get("business_name") or "Business",
            "category": biz.get("category"),
            "license_status": biz.get("license_status"),
        },
        "employee": (
            {
                "name": " ".join(
                    x
                    for x in [emp_user.get("first_name"), emp_user.get("last_name")]
                    if x
                ).strip()
                or None,
                "role_title": emp.get("role_title") if isinstance(emp, dict) else None,
            }
            if emp
            else None
        ),
        "service": {
            "category": booking.get("service_category"),
        },
        "schedule": {
            "confirmed_date": booking.get("confirmed_date"),
            "completed_at": booking.get("completed_at"),
        },
        "line_items": [
            {"label": "Service", "amount": total_amount},
            {
                "label": f"Platform fee ({int((booking.get('commission_rate') or 0.10) * 100)}%)",
                "amount": -platform_cut,
            },
        ],
        "totals": {
            "subtotal": total_amount,
            "platform_cut": platform_cut,
            "paid_to_business": to_business,
            "total_charged": total_amount,
        },
        "payment": {
            "method": payment.get("method") or "stripe_card",
            "status": payment.get("status")
            or booking.get("payment_status")
            or "pending",
            "processor_ref": payment.get("stripe_payment_intent_id"),
        },
    }


@router.get("/{booking_id}/invoice")
def get_invoice(booking_id: str, current_user: dict = Depends(get_current_user)):
    return _load_invoice_data(booking_id, current_user)


@router.get("/{booking_id}/invoice.pdf")
def get_invoice_pdf(booking_id: str, current_user: dict = Depends(get_current_user)):
    data = _load_invoice_data(booking_id, current_user)

    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors as rl_colors
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError:
        raise HTTPException(status_code=503, detail="PDF library unavailable")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceAfter=6)
    small = ParagraphStyle(
        "small", parent=styles["Normal"], fontSize=9, textColor=rl_colors.grey
    )
    body = styles["Normal"]

    story = []

    story.append(Paragraph("<b>SwingBy</b>", h1))
    story.append(Paragraph(f"Invoice {data['invoice_number']}", small))
    story.append(Paragraph(f"Issued {data['issued_at'] or ''}", small))
    story.append(Spacer(1, 14))

    parties = [
        [Paragraph("<b>Bill to</b>", body), Paragraph("<b>From</b>", body)],
        [
            Paragraph(
                f"{data['client']['name']}<br/>{data['client'].get('email') or ''}",
                body,
            ),
            Paragraph(
                f"{data['business']['name']}<br/>{data['business'].get('category') or ''}<br/>"
                f"License: {data['business'].get('license_status') or 'unverified'}",
                body,
            ),
        ],
    ]
    ptbl = Table(parties, colWidths=[3.2 * inch, 3.2 * inch])
    ptbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ]
        )
    )
    story.append(ptbl)
    story.append(Spacer(1, 14))

    if data.get("employee") and data["employee"].get("name"):
        story.append(
            Paragraph(
                f"Service delivered by: {data['employee']['name']} — {data['employee'].get('role_title') or ''}",
                body,
            )
        )
        story.append(Spacer(1, 10))

    if data["service"].get("category") or data["schedule"].get("completed_at"):
        story.append(
            Paragraph(
                f"<b>Service:</b> {data['service'].get('category') or 'Booking'} · "
                f"Completed {data['schedule'].get('completed_at') or '—'}",
                body,
            )
        )
        story.append(Spacer(1, 10))

    rows = [["Description", "Amount (CAD)"]]
    for li in data["line_items"]:
        amount = li["amount"]
        sign = "-" if amount < 0 else ""
        rows.append([li["label"], f"{sign}${abs(amount):,.2f}"])
    rows.append(["", ""])
    rows.append(["Paid to business", f"${data['totals']['paid_to_business']:,.2f}"])
    rows.append(["Total charged", f"${data['totals']['total_charged']:,.2f}"])

    tbl = Table(rows, colWidths=[4.5 * inch, 1.9 * inch])
    tbl.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, rl_colors.grey),
                ("LINEABOVE", (0, -2), (-1, -2), 0.5, rl_colors.grey),
                ("FONT", (0, -2), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 14))

    pay_line = (
        f"Payment: {data['payment']['method']} · Status: {data['payment']['status']}"
    )
    if data["payment"].get("processor_ref"):
        pay_line += f" · Ref: {data['payment']['processor_ref']}"
    story.append(Paragraph(pay_line, small))
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            "Thanks for using SwingBy. Questions? team@swingbyy.com",
            small,
        )
    )

    doc.build(story)
    buf.seek(0)

    filename = f"SwingBy-Invoice-{data['invoice_number']}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
