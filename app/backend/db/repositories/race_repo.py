"""Race repository — Cosmos DB ``races`` collection."""

from __future__ import annotations

from typing import Optional

from azure.cosmos.aio import ContainerProxy

from db.cosmos_client import get_container, CONTAINER_RACES


def _container() -> ContainerProxy:
    return get_container(CONTAINER_RACES)


async def list_races(user_oid: str) -> list[dict]:
    """Return all races belonging to a user (newest first)."""
    query = "SELECT * FROM c WHERE c.user_oid = @oid ORDER BY c.run_at DESC"
    params: list[dict] = [{"name": "@oid", "value": user_oid}]
    items: list[dict] = []
    async for item in _container().query_items(
        query=query,
        parameters=params,
        partition_key=user_oid,
    ):
        items.append(item)
    return items


async def get_race(race_id: str, user_oid: str) -> Optional[dict]:
    """Fetch a single race by ID within the user's partition."""
    try:
        return await _container().read_item(item=race_id, partition_key=user_oid)
    except Exception:
        return None


async def save_race(doc: dict) -> dict:
    """Create or update a race document."""
    return await _container().upsert_item(body=doc)
