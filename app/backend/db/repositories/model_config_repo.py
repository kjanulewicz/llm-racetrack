"""Model config repository — Cosmos DB ``model_configs`` collection."""

from __future__ import annotations

from typing import Optional

from azure.cosmos.aio import ContainerProxy

from db.cosmos_client import get_container, CONTAINER_MODEL_CONFIGS


def _container() -> ContainerProxy:
    return get_container(CONTAINER_MODEL_CONFIGS)


async def list_configs(user_oid: str) -> list[dict]:
    """Return all model configs belonging to a user."""
    query = "SELECT * FROM c WHERE c.user_oid = @oid"
    params: list[dict] = [{"name": "@oid", "value": user_oid}]
    items: list[dict] = []
    async for item in _container().query_items(
        query=query,
        parameters=params,
        partition_key=user_oid,
    ):
        items.append(item)
    return items


async def get_config(config_id: str, user_oid: str) -> Optional[dict]:
    """Fetch a single model config by ID within the user's partition."""
    try:
        return await _container().read_item(item=config_id, partition_key=user_oid)
    except Exception:
        return None


async def upsert_config(doc: dict) -> dict:
    """Create or update a model config document."""
    return await _container().upsert_item(body=doc)


async def delete_config(config_id: str, user_oid: str) -> None:
    """Delete a model config document."""
    await _container().delete_item(item=config_id, partition_key=user_oid)
