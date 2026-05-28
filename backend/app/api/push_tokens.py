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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
def register_push_token(data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
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
