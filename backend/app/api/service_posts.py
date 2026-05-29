import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ServicePostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    category: str = Field(..., min_length=1, max_length=120)
    budget: float = Field(..., gt=0, le=1_000_000)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)

    @field_validator("title", "category", mode="before")
    @classmethod
    def strip_str(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def create_service_post(data: ServicePostCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can create service posts")

    try:
        res = supabase.table("service_posts").insert({
            "client_id": current_user["id"],
            "title": data.title,
            "description": data.description,
            "category": data.category,
            "budget": data.budget,
            "lat": data.lat,
            "lng": data.lng,
            "status": "open",
        }).execute()
        return {"message": "Service post created", "post": res.data[0]}
    except Exception:
        logger.exception("Could not create service post")
        raise HTTPException(status_code=400, detail="Could not create service post")


@router.get("/my")
def list_my_posts(
    status: Optional[Literal["open", "matched", "expired", "cancelled"]] = Query(None),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can view their own posts")
    try:
        query = (
            supabase.table("service_posts")
            .select("*")
            .eq("client_id", current_user["id"])
        )
        if status:
            query = query.eq("status", status)
        res = (
            query
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = res.data or []
        next_offset = offset + limit if len(items) == limit else None
        return {"items": items, "limit": limit, "offset": offset, "next_offset": next_offset}
    except Exception:
        logger.exception("Could not list service posts")
        raise HTTPException(status_code=400, detail="Could not list service posts")


@router.get("/")
def list_open_posts(
    category: Optional[str] = Query(None, max_length=120),
    status: Optional[Literal["open", "matched", "expired", "cancelled"]] = Query(None),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    try:
        query = (
            supabase.table("service_posts")
            .select("*, users(first_name, last_name)")
        )
        # When no status filter given, default to showing only open posts
        # (preserves existing behaviour); with an explicit status, filter by it
        if status:
            query = query.eq("status", status)
        else:
            query = query.eq("status", "open")

        if category:
            query = query.eq("category", category.strip())

        res = (
            query
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = res.data or []
        next_offset = offset + limit if len(items) == limit else None
        return {"items": items, "limit": limit, "offset": offset, "next_offset": next_offset}
    except Exception:
        logger.exception("Could not list open service posts")
        raise HTTPException(status_code=400, detail="Could not list service posts")


@router.get("/{post_id}")
def get_service_post(post_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("service_posts")
            .select("*, users(first_name, last_name)")
            .eq("id", post_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")


@router.delete("/{post_id}")
def cancel_service_post(post_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can cancel their posts")

    post = supabase.table("service_posts").select("client_id, status").eq("id", post_id).single().execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this post")
    if post.data["status"] != "open":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a post with status '{post.data['status']}'")

    try:
        supabase.table("service_posts").update({"status": "cancelled"}).eq("id", post_id).execute()
        return {"message": "Post cancelled"}
    except Exception:
        logger.exception("Could not cancel service post")
        raise HTTPException(status_code=400, detail="Could not cancel service post")
