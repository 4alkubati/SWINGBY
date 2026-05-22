from fastapi import Header, HTTPException
from app.supabase_client import supabase


def get_current_user(authorization: str = Header(...)) -> dict:
    """
    Validates the Bearer JWT from Supabase Auth and returns the matching
    row from our `users` table (includes id, role, first_name, etc.).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[7:]  # strip "Bearer "

    try:
        auth_res = supabase.auth.get_user(token)
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = auth_res.user.id
        db_res = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if not db_res.data:
            raise HTTPException(status_code=401, detail="User not found in database")

        return db_res.data

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
