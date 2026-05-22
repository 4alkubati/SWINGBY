import math
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase

router = APIRouter()


# ── Haversine helper ──────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ── Schemas ───────────────────────────────────────────────────────────────────

class BusinessCreate(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    custom_category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    license_number: Optional[str] = Field(None, max_length=100)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_radius_km: Optional[float] = Field(25.0, ge=1.0, le=500.0)

    @field_validator("business_name", "category", mode="before")
    @classmethod
    def strip_str(cls, v):
        return str(v).strip() if v else v


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    custom_category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    license_number: Optional[str] = Field(None, max_length=100)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_radius_km: Optional[float] = Field(None, ge=1.0, le=500.0)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def create_business(data: BusinessCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can create a business")

    existing = supabase.table("businesses").select("id").eq("owner_id", current_user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You already have a business registered")

    try:
        payload = {"owner_id": current_user["id"], **data.model_dump(exclude_none=True)}
        res = supabase.table("businesses").insert(payload).execute()
        return {"message": "Business created", "business": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/nearby")
def get_nearby_businesses(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Caller latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Caller longitude"),
    radius_km: float = Query(25.0, ge=1.0, le=200.0, description="Search radius in km"),
    category: Optional[str] = Query(None, max_length=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Geo-browse: return businesses whose service area covers the caller's location.

    Uses a bounding-box pre-filter in the query, then Haversine exact filtering
    in Python (no PostGIS required).
    """
    # Rough degree offsets for the bounding box (1° lat ≈ 111 km)
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)) + 1e-9)

    try:
        query = (
            supabase.table("businesses")
            .select("*")
            .gte("lat", lat - lat_delta)
            .lte("lat", lat + lat_delta)
            .gte("lng", lng - lng_delta)
            .lte("lng", lng + lng_delta)
        )
        if category:
            query = query.eq("category", category.strip())

        res = query.execute()
        businesses = res.data or []

        # Exact Haversine filter — only include businesses whose service radius
        # overlaps the caller's location
        nearby = []
        for biz in businesses:
            if biz.get("lat") is None or biz.get("lng") is None:
                continue
            dist = _haversine_km(lat, lng, biz["lat"], biz["lng"])
            biz_radius = biz.get("service_radius_km") or 25.0
            if dist <= min(radius_km, biz_radius):
                nearby.append({**biz, "distance_km": round(dist, 2)})

        # Sort closest first
        nearby.sort(key=lambda b: b["distance_km"])
        return nearby

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
def get_my_business(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners have a business profile")
    try:
        res = supabase.table("businesses").select("*").eq("owner_id", current_user["id"]).single().execute()
        return res.data
    except Exception:
        raise HTTPException(status_code=404, detail="No business found for this account")


@router.get("/")
def list_businesses(
    category: Optional[str] = Query(None, max_length=100),
    current_user: dict = Depends(get_current_user),
):
    try:
        query = supabase.table("businesses").select("*")
        if category:
            query = query.eq("category", category.strip())
        res = query.execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{business_id}")
def get_business(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("businesses").select("*").eq("id", business_id).single().execute()
        return res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Business not found")


@router.patch("/{business_id}")
def update_business(
    business_id: str,
    data: BusinessUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can update a business")

    biz = supabase.table("businesses").select("owner_id").eq("id", business_id).single().execute()
    if not biz.data:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.data["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this business")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        res = supabase.table("businesses").update(update_data).eq("id", business_id).execute()
        return {"message": "Business updated", "business": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
