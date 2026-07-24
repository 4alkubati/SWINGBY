from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Literal
from app.deps import get_current_user
from app.supabase_client import supabase

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class PushTokenRegister(BaseModel):
    token: str = Field(..., min_length=1, max_length=512)
    platform: Literal["ios", "android", "web"]


class PushTokenUnregister(BaseModel):
    token: str = Field(..., min_length=1, max_length=512)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/register")
def register_push_token(
    data: PushTokenRegister, current_user: dict = Depends(get_current_user)
):
    try:
        res = (
            supabase.table("push_tokens")
            .upsert(
                {
                    "user_id": current_user["id"],
                    "token": data.token,
                    "platform": data.platform,
                },
                on_conflict="user_id,token",
            )
            .execute()
        )
        row_id = res.data[0]["id"]
        return {"message": "registered", "token_id": row_id}
    except Exception:
        raise HTTPException(status_code=400, detail="Could not register push token")


@router.post("/unregister")
def unregister_push_token(
    data: PushTokenUnregister, current_user: dict = Depends(get_current_user)
):
    """
    Remove this device's Expo token for the current user.

    Called on logout. Without it, the token row survives sign-out and the next
    user to log in on the same physical device would receive the previous
    user's push notifications (both rows carry the same token). Scoped to
    user_id AND token so a user can only ever delete their own row. Best-effort:
    a delete that matches nothing still returns 200 (idempotent logout).
    """
    try:
        (
            supabase.table("push_tokens")
            .delete()
            .eq("user_id", current_user["id"])
            .eq("token", data.token)
            .execute()
        )
        return {"message": "unregistered"}
    except Exception:
        raise HTTPException(status_code=400, detail="Could not unregister push token")
