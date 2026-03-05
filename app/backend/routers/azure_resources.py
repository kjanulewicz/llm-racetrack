"""Azure resource discovery route — ``GET /azure/foundry-resources``.

Forwards the authenticated user's Bearer token to Azure Resource Manager
to enumerate subscriptions and AI Foundry workspaces.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from auth.jwt_validator import UserClaims, get_current_user, oauth2_scheme
from services import arm

router = APIRouter()


@router.get("/azure/foundry-resources")
async def list_foundry_resources(
    user: UserClaims = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
) -> list[dict]:
    """Return Azure AI Foundry workspaces accessible to the authenticated user.

    Uses the user's delegated Bearer token forwarded to ARM so that only
    resources the user has access to are returned.
    """
    try:
        resources = await arm.list_foundry_resources(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to query Azure Resource Manager: {exc}",
        )

    return [
        {
            "subscription_id": r.subscription_id,
            "subscription_name": r.subscription_name,
            "resource_group": r.resource_group,
            "workspace_name": r.workspace_name,
            "inference_endpoint": r.inference_endpoint,
        }
        for r in resources
    ]
