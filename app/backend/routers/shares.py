"""Share routes — ``POST /race/{id}/share`` and ``GET /me/shared``.

Allows users to share race results with colleagues within the same Azure AD
tenant by providing a recipient email.  The email is resolved to an Entra OID
via the Microsoft Graph API before the share document is persisted.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from auth.jwt_validator import UserClaims, get_current_user, oauth2_scheme
from db.repositories import race_repo, share_repo
from models.schemas import Share, ShareRequest
from services import graph

router = APIRouter()


@router.post("/race/{race_id}/share", response_model=Share, status_code=status.HTTP_201_CREATED)
async def share_race(
    race_id: str,
    body: ShareRequest,
    user: UserClaims = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
) -> Share:
    """Share a race result with a colleague.

    Resolves the recipient email to an Entra OID via Microsoft Graph,
    validates the recipient is in the same tenant, and writes a share
    document to Cosmos DB.
    """
    # Verify the race exists and belongs to the user
    race = await race_repo.get_race(race_id, user.oid)
    if race is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Race not found",
        )

    # Resolve email to OID (raises 403 if not found / different tenant)
    recipient_oid = await graph.resolve_email_to_oid(body.recipient_email, token)

    share_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    share_doc = Share(
        id=share_id,
        partitionKey=recipient_oid,
        race_id=race_id,
        owner_oid=user.oid,
        owner_name=user.name,
        recipient_oid=recipient_oid,
        shared_at=now,
    )

    await share_repo.create_share(share_doc.model_dump(mode="json"))
    return share_doc


@router.get("/me/shared", response_model=list[Share])
async def list_shared_with_me(
    user: UserClaims = Depends(get_current_user),
) -> list[Share]:
    """Return race results that have been shared with the authenticated user."""
    docs = await share_repo.list_shared_with_user(user.oid)
    return [Share(**d) for d in docs]
