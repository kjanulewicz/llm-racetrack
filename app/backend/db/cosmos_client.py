"""Async Cosmos DB client wrapper.

Provides a singleton async Cosmos DB client that is initialised once during
application startup and closed on shutdown.  Uses ``DefaultAzureCredential``
for RBAC-based authentication (Managed Identity in production, ``az login``
locally).
"""

from __future__ import annotations

from azure.cosmos.aio import CosmosClient, DatabaseProxy, ContainerProxy

from auth.credentials import get_azure_credential
from settings import get_settings

DATABASE_NAME = "llm_racetrack"

# Container names (match section 6 of the brief)
CONTAINER_USERS = "users"
CONTAINER_MODEL_CONFIGS = "model_configs"
CONTAINER_PROMPT_TEMPLATES = "prompt_templates"
CONTAINER_RACES = "races"
CONTAINER_SHARES = "shares"

_client: CosmosClient | None = None
_database: DatabaseProxy | None = None


async def init_cosmos() -> None:
    """Initialise the async Cosmos DB client.  Call once at startup."""
    global _client, _database
    settings = get_settings()
    if not settings.COSMOS_URL:
        return  # Allow app to start without Cosmos for local scaffold testing
    _client = CosmosClient(
        url=settings.COSMOS_URL,
        credential=get_azure_credential(),
    )
    _database = _client.get_database_client(DATABASE_NAME)


async def close_cosmos() -> None:
    """Close the Cosmos DB client.  Call on shutdown."""
    global _client, _database
    if _client is not None:
        await _client.close()
        _client = None
        _database = None


def get_database() -> DatabaseProxy:
    """Return the current database proxy (must call ``init_cosmos`` first)."""
    if _database is None:
        raise RuntimeError(
            "Cosmos DB client not initialised. "
            "Ensure init_cosmos() was called during startup."
        )
    return _database


def get_container(name: str) -> ContainerProxy:
    """Return a container proxy by name."""
    return get_database().get_container_client(name)
