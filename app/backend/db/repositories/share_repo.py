"""Share repository — Cosmos DB ``shares`` collection."""

from __future__ import annotations

from azure.cosmos.aio import ContainerProxy

from db.cosmos_client import get_container, CONTAINER_SHARES


def _container() -> ContainerProxy:
    return get_container(CONTAINER_SHARES)


async def list_shared_with_user(recipient_oid: str) -> list[dict]:
    """Return all shares where the given user is the recipient."""
    query = "SELECT * FROM c WHERE c.recipient_oid = @oid ORDER BY c.shared_at DESC"
    params: list[dict] = [{"name": "@oid", "value": recipient_oid}]
    items: list[dict] = []
    async for item in _container().query_items(
        query=query,
        parameters=params,
        partition_key=recipient_oid,
    ):
        items.append(item)
    return items


async def create_share(doc: dict) -> dict:
    """Insert a new share document."""
    return await _container().create_item(body=doc)
