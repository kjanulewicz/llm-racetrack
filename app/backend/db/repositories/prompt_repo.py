"""Prompt template repository — Cosmos DB ``prompt_templates`` collection."""

from __future__ import annotations

from typing import Optional

from azure.cosmos.aio import ContainerProxy
from azure.cosmos.exceptions import CosmosResourceNotFoundError

from db.cosmos_client import get_container, CONTAINER_PROMPT_TEMPLATES


def _container() -> ContainerProxy:
    return get_container(CONTAINER_PROMPT_TEMPLATES)


async def list_templates(user_oid: str) -> list[dict]:
    """Return all prompt templates belonging to a user."""
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


async def get_template(template_id: str, user_oid: str) -> Optional[dict]:
    """Fetch a single template by ID within the user's partition."""
    try:
        return await _container().read_item(item=template_id, partition_key=user_oid)
    except CosmosResourceNotFoundError:
        return None


async def upsert_template(doc: dict) -> dict:
    """Create or update a prompt template document."""
    return await _container().upsert_item(body=doc)


async def delete_template(template_id: str, user_oid: str) -> None:
    """Delete a prompt template document."""
    await _container().delete_item(item=template_id, partition_key=user_oid)
