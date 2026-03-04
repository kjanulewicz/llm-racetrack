"""User profile repository — Cosmos DB ``users`` collection."""

from __future__ import annotations

from typing import Optional

from azure.cosmos.aio import ContainerProxy

from db.cosmos_client import get_container, CONTAINER_USERS
from models.schemas import UserProfile


def _container() -> ContainerProxy:
    return get_container(CONTAINER_USERS)


async def get_user(user_oid: str) -> Optional[dict]:
    """Fetch a user document by OID (also the partition key)."""
    try:
        return await _container().read_item(item=user_oid, partition_key=user_oid)
    except Exception:
        return None


async def upsert_user(user: dict) -> dict:
    """Create or update a user document."""
    return await _container().upsert_item(body=user)
