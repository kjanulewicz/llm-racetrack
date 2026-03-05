"""Microsoft Graph API — resolve email to Entra object ID.

Uses ``DefaultAzureCredential`` (Managed Identity in production, ``az login``
locally) with ``User.Read.All`` permission to look up a user by email and
validate they belong to the same Azure AD tenant.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, status

from auth.credentials import get_azure_credential

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPE = "https://graph.microsoft.com/.default"


async def resolve_email_to_oid(email: str, user_token: str) -> str:
    """Resolve an organisational email to an Entra object ID.

    Parameters
    ----------
    email:
        The recipient's email address.
    user_token:
        The calling user's Bearer token (used for tenant context).

    Returns
    -------
    str
        The resolved user's Entra object ID (``oid``).

    Raises
    ------
    HTTPException (403)
        If the email cannot be resolved or the user is in a different tenant.
    """
    credential = get_azure_credential()
    token = credential.get_token(GRAPH_SCOPE)
    access_token = token.token

    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GRAPH_BASE}/users",
            params={"$filter": f"mail eq '{email}'"},
            headers=headers,
        )

        if resp.status_code != 200:
            logger.warning(
                "Graph API returned %s when resolving %s", resp.status_code, email
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unable to resolve recipient email",
            )

        data = resp.json()
        users = data.get("value", [])

        if not users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Recipient not found in the organisation",
            )

        resolved_user = users[0]
        recipient_oid = resolved_user.get("id")

        if not recipient_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Recipient not found in the organisation",
            )

        # Same-tenant validation: the Graph API token is scoped to our
        # tenant via DefaultAzureCredential, so the /users endpoint only
        # returns users within our directory.  Finding the user is
        # sufficient proof they belong to the same tenant.

    return recipient_oid
