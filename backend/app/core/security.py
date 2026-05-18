from __future__ import annotations

from typing import Any

import jwt
from fastapi import HTTPException, status

from app.core.config import settings


def _resolve_issuer() -> str | None:
    if settings.supabase_jwt_issuer:
        return settings.supabase_jwt_issuer

    if settings.supabase_url:
        return f"{str(settings.supabase_url).rstrip('/')}/auth/v1"

    return None


def decode_supabase_access_token(token: str) -> dict[str, Any]:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWT secret is not configured.",
        )

    decode_options: dict[str, Any] = {"require": ["exp", "sub"]}
    issuer = _resolve_issuer()

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
            issuer=issuer,
            options=decode_options,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token.") from exc

    return payload
