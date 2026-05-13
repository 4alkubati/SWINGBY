from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

router = APIRouter()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone: str
    role: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/signup")
def signup(data: SignupRequest):
    if data.role not in ["client", "business_owner"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    try:
        res = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
        })
        user_id = res.user.id
        supabase.table("users").insert({
            "id": user_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": data.email,
            "phone": data.phone,
            "role": data.role,
        }).execute()
        return {"message": "Account created", "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
def login(data: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password,
        })
        return {
            "access_token": res.session.access_token,
            "user_id": res.user.id,
            "role": res.user.user_metadata.get("role")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")