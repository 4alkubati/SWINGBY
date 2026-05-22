from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    role_title: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Name fields cannot be blank")
        return v


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_owner_business(owner_id: str) -> dict:
    res = supabase.table("businesses").select("id").eq("owner_id", owner_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="You don't have a business registered yet")
    return res.data


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def create_employee(data: EmployeeCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can create employees")

    biz = _get_owner_business(current_user["id"])

    try:
        # Create Supabase Auth user for the employee (requires service_role key)
        auth_res = supabase.auth.admin.create_user({
            "email": str(data.email),
            "password": data.password,
            "email_confirm": True,
        })
        emp_user_id = auth_res.user.id

        supabase.table("users").insert({
            "id": emp_user_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": str(data.email),
            "phone": data.phone,
            "role": "employee",
        }).execute()

        emp_res = supabase.table("employees").insert({
            "business_id": biz["id"],
            "user_id": emp_user_id,
            "role_title": data.role_title,
            "avatar_url": data.avatar_url,
            "is_active": True,
        }).execute()

        return {"message": "Employee created", "employee": emp_res.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def list_employees(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can list employees")

    biz = _get_owner_business(current_user["id"])

    try:
        res = (
            supabase.table("employees")
            .select("*, users(first_name, last_name, email, phone)")
            .eq("business_id", biz["id"])
            .order("created_at")
            .execute()
        )
        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{employee_id}/deactivate")
def deactivate_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can deactivate employees")

    biz = _get_owner_business(current_user["id"])
    emp = (
        supabase.table("employees")
        .select("id")
        .eq("id", employee_id)
        .eq("business_id", biz["id"])
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(status_code=404, detail="Employee not found in your business")

    try:
        res = supabase.table("employees").update({"is_active": False}).eq("id", employee_id).execute()
        return {"message": "Employee deactivated", "employee": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{employee_id}/reactivate")
def reactivate_employee(employee_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can reactivate employees")

    biz = _get_owner_business(current_user["id"])
    emp = (
        supabase.table("employees")
        .select("id")
        .eq("id", employee_id)
        .eq("business_id", biz["id"])
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(status_code=404, detail="Employee not found in your business")

    try:
        res = supabase.table("employees").update({"is_active": True}).eq("id", employee_id).execute()
        return {"message": "Employee reactivated", "employee": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
