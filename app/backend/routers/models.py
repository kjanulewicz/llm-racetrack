"""Model configuration routes.

- ``GET  /models/defaults``      — org-wide seed list (no auth)
- ``GET  /me/models``            — user's saved model configs
- ``POST /me/models``            — create a new model config
- ``DELETE /me/models/{id}``     — remove a model config
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from auth.jwt_validator import UserClaims, get_current_user
from config.loader import get_model_defaults
from db.repositories import model_config_repo
from models.schemas import DefaultModel, ModelConfig, ModelConfigCreate

router = APIRouter()


# ---------------------------------------------------------------------------
# Public — no auth
# ---------------------------------------------------------------------------


@router.get("/models/defaults", response_model=list[DefaultModel])
async def list_default_models() -> list[DefaultModel]:
    """Return the org-wide default model list from ``models.config.json``."""
    return get_model_defaults()


# ---------------------------------------------------------------------------
# Protected — user-scoped model configs
# ---------------------------------------------------------------------------


@router.get("/me/models", response_model=list[ModelConfig])
async def list_user_models(
    user: UserClaims = Depends(get_current_user),
) -> list[ModelConfig]:
    """Return all saved model configurations for the authenticated user."""
    docs = await model_config_repo.list_configs(user.oid)
    return [ModelConfig(**d) for d in docs]


@router.post("/me/models", response_model=ModelConfig, status_code=status.HTTP_201_CREATED)
async def create_user_model(
    body: ModelConfigCreate,
    user: UserClaims = Depends(get_current_user),
) -> ModelConfig:
    """Save a new model configuration for the authenticated user."""
    # Validate: Foundry models must have an HTTPS endpoint_url
    if body.provider == "azure_foundry":
        if not body.endpoint_url or not body.endpoint_url.startswith("https://"):
            raise HTTPException(
                status_code=422,
                detail="Azure AI Foundry models require a valid HTTPS endpoint_url",
            )

    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = ModelConfig(
        id=config_id,
        partitionKey=user.oid,
        user_oid=user.oid,
        base_model_id=body.base_model_id,
        label=body.label,
        provider=body.provider,
        endpoint_url=body.endpoint_url,
        subscription_id=body.subscription_id,
        resource_group=body.resource_group,
        color=body.color,
        created_at=now,
    )
    await model_config_repo.upsert_config(doc.model_dump(mode="json"))
    return doc


@router.delete("/me/models/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_model(
    config_id: str,
    user: UserClaims = Depends(get_current_user),
) -> None:
    """Delete a user model configuration by ID."""
    existing = await model_config_repo.get_config(config_id, user.oid)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model configuration not found",
        )
    await model_config_repo.delete_config(config_id, user.oid)
