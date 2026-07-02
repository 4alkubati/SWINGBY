from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import os
from notion_client import Client

router = APIRouter()

# ── Notion client ─────────────────────────────────────────────────────────────


def get_notion():
    token = os.getenv("NOTION_TOKEN") or os.getenv("Notion_Token")
    if not token:
        raise RuntimeError("NOTION_TOKEN is not set")
    return Client(auth=token)


WAITLIST_DB_ID = "a0fceda5610e474fac5949ec6ab8d012"


# ── Schema ────────────────────────────────────────────────────────────────────


class WaitlistEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: Optional[str] = Field(None)  # "Client" | "Business" | None
    city: Optional[str] = Field(None, max_length=100)
    message: Optional[str] = Field(None, max_length=1000)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return str(v).strip()

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v):
        if v is None:
            return "Unknown"
        allowed = {"Client", "Business", "Unknown"}
        if v not in allowed:
            return "Unknown"
        return v


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/")
def join_waitlist(data: WaitlistEntry):
    """
    Public endpoint — no auth required.
    Adds a new entry to the SwingBy Waitlist Notion database.
    """
    try:
        notion = get_notion()

        notion.pages.create(
            parent={"database_id": WAITLIST_DB_ID},
            properties={
                "Name": {"title": [{"text": {"content": data.name}}]},
                "Email": {"email": data.email},
                "Role": {"select": {"name": data.role or "Unknown"}},
                "City": {"rich_text": [{"text": {"content": data.city or ""}}]},
                "Message": {"rich_text": [{"text": {"content": data.message or ""}}]},
            },
        )

        return {"message": "You're on the list! We'll be in touch."}

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
