"""Pydantic schemas for the llm-racetrack data models.

These mirror the Cosmos DB document shapes defined in section 6 of the brief.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserPreferences(BaseModel):
    theme: str = "arcade-dark"
    default_model_ids: list[str] = Field(default_factory=list)


class UserProfile(BaseModel):
    id: str
    partitionKey: str
    email: str
    name: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    created_at: datetime


# ---------------------------------------------------------------------------
# Model config (per-user model slot)
# ---------------------------------------------------------------------------

class ModelConfig(BaseModel):
    id: str
    partitionKey: str
    user_oid: str
    base_model_id: str
    label: str
    provider: str  # "azure_openai" | "azure_foundry"
    endpoint_url: Optional[str] = None
    subscription_id: Optional[str] = None
    resource_group: Optional[str] = None
    color: str = "#38bdf8"
    created_at: datetime


# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

class PromptTemplate(BaseModel):
    id: str
    partitionKey: str
    user_oid: str
    name: str
    content: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Race
# ---------------------------------------------------------------------------

class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    cached_tokens: int = 0
    completion_tokens: int = 0


class RaceResult(BaseModel):
    model_config_id: str
    label: str
    system_prompt: str
    response_text: str
    elapsed_ms: float
    ttft_ms: float
    usage: TokenUsage
    finish_position: int


class Race(BaseModel):
    id: str
    partitionKey: str
    user_oid: str
    user_input: str
    run_at: datetime
    results: list[RaceResult] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Share
# ---------------------------------------------------------------------------

class Share(BaseModel):
    id: str
    partitionKey: str
    race_id: str
    owner_oid: str
    owner_name: str
    recipient_oid: str
    shared_at: datetime


# ---------------------------------------------------------------------------
# Org-wide default model (from models.config.json)
# ---------------------------------------------------------------------------

class DefaultModel(BaseModel):
    """A single entry from the org-wide ``models.config.json``."""

    id: str
    name: str
    provider: str
    description: str = ""
    default_endpoint_url: Optional[str] = None
