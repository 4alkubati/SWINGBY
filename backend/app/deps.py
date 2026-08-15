import jwt
from fastapi import Header, HTTPException, Query
from app.supabase_client import supabase
from app.services import session_security


def _issued_at(token: str):
    """Read the `iat` claim off an ALREADY-VALIDATED access token.

    Signature verification is skipped here on purpose, and only because the
    caller has already proven this token authentic via
    `supabase.auth.get_user(token)` — a remote call that checks the signature
    against Supabase. Decoding a second time locally would buy nothing and cost
    a round trip; all we need back is the timestamp.

    Never call this on a token that has not been through `get_user` first.

    Returns None if the claim is missing or the token will not decode. Callers
    treat None as "cannot place this token in time", which fails open — see
    `session_security.is_token_revoked`.
    """
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
        return claims.get("iat")
    except Exception:
        return None


def _user_from_token(token: str) -> dict:
    """Validate a Supabase JWT and return the matching `users` row.

    Shared core for every auth entry point. Raises 401 for a bad/expired token
    and 403 for a valid token on a suspended / soft-deleted account.
    """
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

        # D7.4 — the revocation watermark. A password change, or a detected
        # refresh-token replay, stamps `sessions_valid_after`; every access
        # token minted before that instant is dead from this line onward.
        #
        # Checked HERE rather than only at /auth/refresh because an access
        # token lives ~1h on its own. Without this, "I changed my password"
        # would leave the attacker a full hour of continued access — the exact
        # window the finding is about. 401, not 403: the token is genuinely no
        # longer valid, and the client's existing 401 path already knows to
        # send the user back to a login screen.
        #
        # The users row is already in hand from the select above, so this costs
        # no extra query.
        if session_security.is_token_revoked(
            _issued_at(token), user.get("sessions_valid_after")
        ):
            raise HTTPException(status_code=401, detail="Session revoked")

        return user

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


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

    return _user_from_token(authorization[7:])  # strip "Bearer "


def get_current_user_allow_query_token(
    authorization: str | None = Header(None),
    token: str | None = Query(None),
) -> dict:
    """Auth dependency that accepts the JWT via the Authorization header OR a
    ``?token=`` query param.

    NARROW USE ONLY — this exists for the invoice-PDF route, which the mobile
    client opens with ``Linking.openURL`` (the system browser, which cannot
    attach an Authorization header). The header is preferred when present.

    SECURITY NOTE: a token in the query string can leak into server/access
    logs and browser history. It is a short-lived Supabase JWT over HTTPS, and
    this is scoped to a single read-only PDF endpoint. Post-beta this should
    move to an in-app authenticated download (expo-file-system ``downloadAsync``
    with the header + ``expo-sharing``) so no token ever rides in a URL.
    """
    if authorization and authorization.startswith("Bearer "):
        return _user_from_token(authorization[7:])
    if token:
        return _user_from_token(token)
    raise HTTPException(
        status_code=401, detail="Missing or invalid Authorization header"
    )
