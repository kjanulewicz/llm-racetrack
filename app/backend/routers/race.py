"""Race route — ``POST /race`` (Server-Sent Events stream)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from auth.jwt_validator import UserClaims, get_current_user
from db.repositories import model_config_repo
from models.schemas import ModelConfig, RaceRequest
from services.race_runner import run_race
from settings import get_settings

router = APIRouter()

# ---------------------------------------------------------------------------
# DEV_MODE default mock models
# ---------------------------------------------------------------------------

_MOCK_MODELS: list[dict] = [
    {
        "id": "mock-gpt",
        "partitionKey": "dev",
        "user_oid": "dev",
        "base_model_id": "mock-gpt",
        "label": "Mock GPT",
        "provider": "mock",
        "endpoint_url": "https://mock.local",
        "color": "#38bdf8",
        "created_at": "2025-01-01T00:00:00Z",
    },
    {
        "id": "mock-mistral",
        "partitionKey": "dev",
        "user_oid": "dev",
        "base_model_id": "mock-mistral",
        "label": "Mock Mistral",
        "provider": "mock",
        "endpoint_url": "https://mock.local",
        "color": "#f472b6",
        "created_at": "2025-01-01T00:00:00Z",
    },
]


def _build_mock_model(model_id: str) -> ModelConfig:
    """Return a mock :class:`ModelConfig` for *model_id*.

    Tries to match one of the default mock models by id; if no match is found,
    a generic mock config is created.
    """
    for tpl in _MOCK_MODELS:
        if tpl["id"] == model_id:
            return ModelConfig(**tpl)
    return ModelConfig(
        id=model_id,
        partitionKey="dev",
        user_oid="dev",
        base_model_id=model_id,
        label=model_id,
        provider="mock",
        endpoint_url="https://mock.local",
        color="#38bdf8",
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )


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
    settings = get_settings()

    if settings.DEV_MODE:
        # Build mock model configs — no Cosmos DB lookup needed
        model_entries: list[tuple[ModelConfig, str]] = [
            (_build_mock_model(entry.model_config_id), entry.system_prompt)
            for entry in body.models
        ]
    else:
        # Resolve model configs from the user's Cosmos DB entries
        model_entries = []
        for entry in body.models:
            doc = await model_config_repo.get_config(
                entry.model_config_id, user.oid
            )
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
