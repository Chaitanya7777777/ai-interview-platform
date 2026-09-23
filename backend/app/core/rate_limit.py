"""Per-user rate limiting via SlowAPI.

Rate limit key function extracts user_id from the Supabase JWT.
Falls back to client IP for unauthenticated endpoints.

Usage in route files:
    from app.core.rate_limit import limiter

    @router.post("/endpoint")
    @limiter.limit("5/minute")
    async def my_endpoint(request: Request, ...):
        ...
"""

from __future__ import annotations

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = logging.getLogger(__name__)


def _rate_limit_key(request: Request) -> str:
    """Extract user ID from JWT for per-user rate limiting.

    Falls back to client IP address when:
    - No Authorization header present
    - Token is invalid or expired
    - Any decoding error occurs
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and len(auth) > 7:
        try:
            from app.core.security import decode_supabase_access_token  # noqa: PLC0415

            payload = decode_supabase_access_token(auth[7:])
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:  # noqa: BLE001 — never fail rate limiting
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
