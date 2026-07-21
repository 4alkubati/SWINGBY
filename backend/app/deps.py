from fastapi import Header, HTTPException
from app.supabase_client import supabase


def get_current_user(authorization: str | None = Header(None)) -> dict:
    """
    Validates the Bearer JWT from Supabase Auth and returns the matching
    row from our `users` table (includes id, role, first_name, etc.).

    The header is Optional so a missing token yields 401, not a 422
    validation error.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization[7:]  # strip "Bearer "

    try:
        auth_res = supabase.auth.get_user(token)
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = auth_res.user.id
        db_res = (
            supabase.table("users").select("*").eq("id", user_id).single().execute()
        )
        if not db_res.data:
            raise HTTPException(status_code=401, detail="User not found in database")

        user = db_res.data

        # Account-lifecycle enforcement. These columns are written by admin
        # actions / self-service delete but must ALSO be read on every request
        # or they have zero effect. A soft-deleted or suspended account is
        # fully locked out (403, not 401 — the token itself is valid).
        if user.get("deleted_at"):
            raise HTTPException(status_code=403, detail="account_deactivated")
        if user.get("is_suspended"):
            raise HTTPException(status_code=403, detail="account_suspended")

        return user

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
