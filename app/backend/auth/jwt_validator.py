"""Entra ID JWT validation and ``get_current_user`` FastAPI dependency.

Validates the Bearer token issued by the organisation's Azure AD tenant,
extracts the user's ``oid``, ``preferred_username``, and ``name`` claims,
and returns a :class:`UserClaims` instance that downstream route handlers
use to scope all Cosmos DB queries to the authenticated user.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2AuthorizationCodeBearer

from settings import get_settings

# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class UserClaims:
    """Claims extracted from a validated Entra ID JWT."""

    oid: str
    email: str
    name: str


# ---------------------------------------------------------------------------
# OAuth2 scheme — tells Swagger UI where to find the token
# ---------------------------------------------------------------------------

_settings = get_settings()

oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"https://login.microsoftonline.com/{_settings.TENANT_ID}/oauth2/v2.0/authorize",
    tokenUrl=f"https://login.microsoftonline.com/{_settings.TENANT_ID}/oauth2/v2.0/token",
    auto_error=not _settings.DEV_MODE,
)

# ---------------------------------------------------------------------------
# JWKS caching
# ---------------------------------------------------------------------------

_jwks_cache: dict | None = None
_jwks_lock = asyncio.Lock()


async def _get_jwks(tenant_id: str) -> dict:
    """Fetch (and cache) the tenant's JSON Web Key Set."""
    global _jwks_cache
    async with _jwks_lock:
        if _jwks_cache is not None:
            return _jwks_cache
        jwks_url = (
            f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


def _find_rsa_key(jwks: dict, kid: str) -> dict | None:
    """Return the JWK matching the given ``kid``, or *None*."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


# ---------------------------------------------------------------------------
# Token validation
# ---------------------------------------------------------------------------


async def validate_entra_token(
    token: str,
    *,
    tenant_id: str,
    audience: str,
) -> dict:
    """Validate an Entra ID JWT and return the decoded payload.

    Raises :class:`~fastapi.HTTPException` (401) on any validation failure.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.DecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {exc}",
        )

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing 'kid'",
        )

    jwks = await _get_jwks(tenant_id)
    rsa_key = _find_rsa_key(jwks, kid)
    if rsa_key is None:
        # Key might have rotated — invalidate cache and refetch once.
        async with _jwks_lock:
            global _jwks_cache
            _jwks_cache = None
        jwks = await _get_jwks(tenant_id)
        rsa_key = _find_rsa_key(jwks, kid)
        if rsa_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find matching signing key",
            )

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(rsa_key)

    issuer = f"https://login.microsoftonline.com/{tenant_id}/v2.0"

    try:
        payload: dict = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iss", "aud", "oid"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {exc}",
        )

    # Validate tenant
    if payload.get("tid") != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is from an unexpected tenant",
        )

    return payload


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


_DEV_USER = UserClaims(
    oid="00000000-0000-0000-0000-000000000000",
    email="dev@localhost",
    name="Local Developer",
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> UserClaims:
    """FastAPI dependency — validates the JWT and returns :class:`UserClaims`.

    Applied to every protected route.
    """
    settings = get_settings()
    if settings.DEV_MODE:
        return _DEV_USER
    payload = await validate_entra_token(
        token,
        tenant_id=settings.TENANT_ID,
        audience=settings.API_CLIENT_ID,
    )
    return UserClaims(
        oid=payload["oid"],
        email=payload.get("preferred_username", ""),
        name=payload.get("name", ""),
    )
