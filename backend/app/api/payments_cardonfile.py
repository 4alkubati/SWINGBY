"""
payments_cardonfile.py — card-on-file (PAYMENT-MODEL.md §5).

"Card on file is created with a Stripe SetupIntent and a saved payment
method on a Stripe Customer. No charge at this point."

Flow (mobile, out of this agent's scope, drives the Stripe SDK client-side):
  1. POST /payments/card-on-file/setup-intent  -> {client_secret}
     Mobile confirms the SetupIntent with Stripe's SDK using the client's
     card details — no money moves.
  2. POST /payments/card-on-file/confirm        body {payment_method_id}
     Attaches the now-confirmed PaymentMethod to the customer, sets it
     default, and persists it on `users` so PATCH /interests/{id}/accept can
     charge off-session later.
  3. GET  /payments/card-on-file/status         -> {has_card: bool}
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SetupIntentResponse(BaseModel):
    client_secret: str
    customer_id: str


class ConfirmCardOnFile(BaseModel):
    payment_method_id: str = Field(..., min_length=1, max_length=200)


class CardOnFileStatus(BaseModel):
    has_card: bool


@router.post("/setup-intent", response_model=SetupIntentResponse)
def create_card_setup_intent(current_user: dict = Depends(get_current_user)):
    user_res = (
        supabase.table("users")
        .select("stripe_customer_id")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    existing_customer_id = (user_res.data or {}).get("stripe_customer_id")

    customer_id = stripe_service.get_or_create_customer(
        user_id=current_user["id"],
        email=current_user.get("email"),
        existing_customer_id=existing_customer_id,
    )

    if customer_id != existing_customer_id:
        try:
            supabase.table("users").update({"stripe_customer_id": customer_id}).eq(
                "id", current_user["id"]
            ).execute()
        except Exception:
            logger.exception(
                "Could not persist stripe_customer_id for user %s", current_user["id"]
            )

    intent = stripe_service.create_setup_intent(customer_id=customer_id)
    return SetupIntentResponse(
        client_secret=intent["client_secret"], customer_id=customer_id
    )


@router.post("/confirm")
def confirm_card_on_file(
    data: ConfirmCardOnFile, current_user: dict = Depends(get_current_user)
):
    user_res = (
        supabase.table("users")
        .select("stripe_customer_id")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    customer_id = (user_res.data or {}).get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe customer on file — call setup-intent first.",
        )

    stripe_service.attach_payment_method(
        customer_id=customer_id, payment_method_id=data.payment_method_id
    )

    try:
        supabase.table("users").update(
            {"default_payment_method_id": data.payment_method_id}
        ).eq("id", current_user["id"]).execute()
    except Exception:
        logger.exception(
            "Could not persist default_payment_method_id for user %s",
            current_user["id"],
        )
        raise HTTPException(status_code=400, detail="Could not save card")

    return {"message": "Card saved"}


@router.get("/status", response_model=CardOnFileStatus)
def card_on_file_status(current_user: dict = Depends(get_current_user)):
    user_res = (
        supabase.table("users")
        .select("stripe_customer_id, default_payment_method_id")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    row = user_res.data or {}
    has_card = bool(
        row.get("stripe_customer_id") and row.get("default_payment_method_id")
    )
    return CardOnFileStatus(has_card=has_card)
