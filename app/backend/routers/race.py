"""Race route — ``POST /race`` (Server-Sent Events stream)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from auth.jwt_validator import UserClaims, get_current_user
from db.repositories import model_config_repo
from models.schemas import ModelConfig, RaceRequest
from services.race_runner import run_race

router = APIRouter()


@router.post("/race")
async def start_race(
    body: RaceRequest,
    user: UserClaims = Depends(get_current_user),
) -> EventSourceResponse:
    """Start a parallel model race and stream results as SSE.

    The response is a ``text/event-stream`` with the following event types:

    - ``chunk``  — incremental text from a model
    - ``ttft``   — time-to-first-token for a model
    - ``done``   — a model has finished (includes usage + position)
    - ``error``  — a model encountered an error
    - ``race_complete`` — all models done, includes ``race_id``
    """
    # Resolve model configs from the user's Cosmos DB entries
    model_entries: list[tuple[ModelConfig, str]] = []
    for entry in body.models:
        doc = await model_config_repo.get_config(entry.model_config_id, user.oid)
        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model config {entry.model_config_id!r} not found",
            )
        mc = ModelConfig(**doc)
        model_entries.append((mc, entry.system_prompt))

    return EventSourceResponse(
        run_race(
            user_oid=user.oid,
            user_input=body.user_input,
            model_entries=model_entries,
        ),
        media_type="text/event-stream",
    )
