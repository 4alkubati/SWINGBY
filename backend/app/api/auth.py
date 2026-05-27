from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional
from app.supabase_client import supabase
from app.deps import get_current_user

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("client", "business_owner"):
            raise ValueError("role must be 'client' or 'business_owner'")
        return v

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = str(v).strip()
        if not v:
            raise ValueError("Name fields cannot be blank")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=100)


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    avatar_url: Optional[str] = Field(None, max_length=500)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        if v is not None:
            v = str(v).strip()
            if not v:
                raise ValueError("Name fields cannot be blank")
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(data: SignupRequest):
    try:
        # 1. Create Supabase Auth user
        res = supabase.auth.sign_up({
            "email": str(data.email),
            "password": data.password,
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="Signup failed — check if email is already in use")

        user_id = res.user.id

        # 2. Upsert into our users table.
        # handle_new_user() trigger may have already inserted a bare row (id only).
        # upsert overwrites it with the full profile — no duplicate-key error.
        row = {
            "id": user_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": str(data.email),
            "role": data.role,
        }
        if data.phone:
            row["phone"] = data.phone
        supabase.table("users").upsert(row).execute()

        # If email confirmation is OFF, Supabase returns a live session immediately.
        # Return the token so the mobile app can auto-login.
        access_token = res.session.access_token if res.session else None
        return {
            "message": "Account created" if access_token else "Account created — check your email to confirm",
            "user_id": user_id,
            "access_token": access_token,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(data: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": str(data.email),
            "password": data.password,
        })
        if not res.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        user_id = res.user.id

        # Read role + name from our users table (not Supabase metadata)
        db_res = supabase.table("users").select("role, first_name, last_name").eq("id", user_id).single().execute()
        user_data = db_res.data or {}

        return {
            "access_token": res.session.access_token,
            "user_id": user_id,
            "role": user_data.get("role"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the full profile of the currently authenticated user."""
    # Omit sensitive internal fields before returning
    safe_fields = {
        "id", "first_name", "last_name", "email", "phone", "role", "avatar_url", "created_at"
    }
    return {k: v for k, v in current_user.items() if k in safe_fields}


@router.patch("/me")
def update_me(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update the current user's own profile."""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        res = (
            supabase.table("users")
            .update(update_data)
            .eq("id", current_user["id"])
            .execute()
        )
        return {"message": "Profile updated", "user": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
