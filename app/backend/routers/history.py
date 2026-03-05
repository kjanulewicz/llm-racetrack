"""History routes — ``GET /me/history`` and ``GET /me/history/{id}``.

Provides paginated access to the authenticated user's past races and
full race detail for replay.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth.jwt_validator import UserClaims, get_current_user
from db.repositories import race_repo
from models.schemas import Race

router = APIRouter()

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@router.get("/me/history")
async def list_history(
    user: UserClaims = Depends(get_current_user),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Maximum number of items to return",
    ),
) -> dict:
    """Return a paginated list of the user's past races.

    Returns metadata only (no full response text) for the listing view.
    """
    all_races = await race_repo.list_races(user.oid)

    total = len(all_races)
    page = all_races[offset : offset + limit]

    # Return lightweight metadata — strip response_text from results
    items = []
    for doc in page:
        summary = {
            "id": doc["id"],
            "user_input": doc.get("user_input", ""),
            "run_at": doc.get("run_at", ""),
            "result_count": len(doc.get("results", [])),
            "models": [
                {
                    "model_config_id": r.get("model_config_id", ""),
                    "label": r.get("label", ""),
                    "finish_position": r.get("finish_position", 0),
                    "elapsed_ms": r.get("elapsed_ms", 0),
                }
                for r in doc.get("results", [])
            ],
        }
        items.append(summary)

    return {
        "items": items,
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/me/history/{race_id}", response_model=Race)
async def get_history_detail(
    race_id: str,
    user: UserClaims = Depends(get_current_user),
) -> Race:
    """Return the full race document for replay."""
    doc = await race_repo.get_race(race_id, user.oid)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Race not found",
        )
    return Race(**doc)
