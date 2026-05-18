from __future__ import annotations

from typing import Any

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError

from app.core.config import settings


def _resolve_issuer() -> str | None:
    if settings.supabase_jwt_issuer:
        return settings.supabase_jwt_issuer

    if settings.supabase_url:
        return f"{str(settings.supabase_url).rstrip('/')}/auth/v1"

    return None


def _resolve_jwks_url() -> str:
    issuer = _resolve_issuer()
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase issuer is not configured. Set SUPABASE_URL or SUPABASE_JWT_ISSUER.",
        )

    return f"{issuer.rstrip('/')}/.well-known/jwks.json"


def _decode_hs_token(token: str, issuer: str | None, decode_options: dict[str, Any]) -> dict[str, Any]:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWT secret is not configured.",
        )

    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256", "HS384", "HS512"],
        audience=settings.supabase_jwt_audience,
        issuer=issuer,
        options=decode_options,
    )


def _decode_jwks_token(token: str, issuer: str | None, decode_options: dict[str, Any]) -> dict[str, Any]:
    jwks_client = PyJWKClient(_resolve_jwks_url())

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token).key
    except PyJWKClientError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to resolve Supabase signing key.") from exc

    return jwt.decode(
        token,
        signing_key,
        algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
        audience=settings.supabase_jwt_audience,
        issuer=issuer,
        options=decode_options,
    )


def decode_supabase_access_token(token: str) -> dict[str, Any]:
    decode_options: dict[str, Any] = {"require": ["exp", "sub"]}
    issuer = _resolve_issuer()

    try:
        unverified_header = jwt.get_unverified_header(token)
        algorithm = str(unverified_header.get("alg", "")).upper()

        if algorithm.startswith("HS"):
            payload = _decode_hs_token(token, issuer, decode_options)
        else:
            payload = _decode_jwks_token(token, issuer, decode_options)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token.") from exc

    return payload
