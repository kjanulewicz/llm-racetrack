"""Azure Resource Manager client — list subscriptions and AI Foundry workspaces.

Uses the user's delegated Bearer token (not Managed Identity) so that only
resources the authenticated user has access to are returned.  Calls are made
via ``httpx`` (async) against the ARM REST API.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

ARM_BASE = "https://management.azure.com"
SUBSCRIPTIONS_API = "2022-12-01"
RESOURCES_API = "2021-04-01"
ML_WORKSPACE_TYPE = "Microsoft.MachineLearningServices/workspaces"


@dataclass
class FoundryResource:
    """A single AI Foundry workspace discovered via ARM."""

    subscription_id: str
    subscription_name: str
    resource_group: str
    workspace_name: str
    inference_endpoint: str


async def list_foundry_resources(user_token: str) -> list[FoundryResource]:
    """List Azure AI Foundry workspaces accessible to the user.

    Parameters
    ----------
    user_token:
        The user's Bearer token, forwarded to ARM.

    Returns
    -------
    list[FoundryResource]
        Workspaces with their inference endpoint URLs.
    """
    headers = {"Authorization": f"Bearer {user_token}"}
    results: list[FoundryResource] = []

    async with httpx.AsyncClient() as client:
        # Step 1: list subscriptions
        subs_resp = await client.get(
            f"{ARM_BASE}/subscriptions",
            params={"api-version": SUBSCRIPTIONS_API},
            headers=headers,
        )
        subs_resp.raise_for_status()
        subscriptions = subs_resp.json().get("value", [])

        # Step 2: for each subscription, find ML workspaces
        for sub in subscriptions:
            sub_id = sub["subscriptionId"]
            sub_name = sub.get("displayName", sub_id)

            res_resp = await client.get(
                f"{ARM_BASE}/subscriptions/{sub_id}/resources",
                params={
                    "$filter": f"resourceType eq '{ML_WORKSPACE_TYPE}'",
                    "api-version": RESOURCES_API,
                },
                headers=headers,
            )
            res_resp.raise_for_status()
            resources = res_resp.json().get("value", [])

            for resource in resources:
                workspace_name = resource.get("name", "")
                # Extract resource group from the resource id
                # Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/...
                resource_id: str = resource.get("id", "")
                parts = resource_id.split("/")
                rg = ""
                for i, part in enumerate(parts):
                    if part.lower() == "resourcegroups" and i + 1 < len(parts):
                        rg = parts[i + 1]
                        break

                location = resource.get("location", "")
                # Construct the inference endpoint URL
                inference_endpoint = (
                    f"https://{workspace_name}.{location}.inference.ml.azure.com"
                )

                results.append(
                    FoundryResource(
                        subscription_id=sub_id,
                        subscription_name=sub_name,
                        resource_group=rg,
                        workspace_name=workspace_name,
                        inference_endpoint=inference_endpoint,
                    )
                )

    return results
