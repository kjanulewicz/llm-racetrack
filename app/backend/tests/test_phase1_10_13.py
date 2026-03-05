"""Tests for Phase 1 tasks 1.10–1.13.

Validates:
- File structure for new modules (arm.py, graph.py, azure_resources.py,
  shares.py, history.py)
- Module interfaces (callable functions, correct signatures)
- API routes via TestClient with auth + service mocking
- Pydantic request/response schemas (ShareRequest)
- OpenAPI spec includes all new endpoints
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BACKEND_ROOT = Path(__file__).resolve().parent.parent

FAKE_USER_OID = "00000000-0000-0000-0000-000000000001"
FAKE_USER = None  # populated lazily


def _get_fake_user():
    global FAKE_USER
    if FAKE_USER is None:
        from auth.jwt_validator import UserClaims

        FAKE_USER = UserClaims(oid=FAKE_USER_OID, email="test@org.com", name="Test User")
    return FAKE_USER


def _make_client():
    """Build a TestClient with get_current_user and oauth2_scheme overridden."""
    from auth.jwt_validator import get_current_user, oauth2_scheme
    from main import app

    app.dependency_overrides[get_current_user] = lambda: _get_fake_user()
    app.dependency_overrides[oauth2_scheme] = lambda: "fake-bearer-token"
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Project structure — new files must exist
# ---------------------------------------------------------------------------


class TestProjectStructurePhase1_10_13:
    @pytest.mark.parametrize(
        "rel_path",
        [
            "services/arm.py",
            "services/graph.py",
            "routers/azure_resources.py",
            "routers/shares.py",
            "routers/history.py",
        ],
    )
    def test_file_exists(self, rel_path: str):
        assert (BACKEND_ROOT / rel_path).exists(), f"Missing: {rel_path}"


# ---------------------------------------------------------------------------
# Schemas — ShareRequest
# ---------------------------------------------------------------------------


class TestShareRequestSchema:
    def test_share_request(self):
        from models.schemas import ShareRequest

        sr = ShareRequest(recipient_email="colleague@org.com")
        assert sr.recipient_email == "colleague@org.com"

    def test_share_request_requires_email(self):
        from models.schemas import ShareRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ShareRequest()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# Service modules — interface checks
# ---------------------------------------------------------------------------


class TestServiceModulesPhase1_10_13:
    def test_arm_has_list_foundry_resources(self):
        from services import arm

        assert hasattr(arm, "list_foundry_resources")
        assert callable(arm.list_foundry_resources)

    def test_graph_has_resolve_email_to_oid(self):
        from services import graph

        assert hasattr(graph, "resolve_email_to_oid")
        assert callable(graph.resolve_email_to_oid)

    def test_arm_foundry_resource_dataclass(self):
        from services.arm import FoundryResource

        r = FoundryResource(
            subscription_id="sub1",
            subscription_name="My Sub",
            resource_group="rg1",
            workspace_name="ws1",
            inference_endpoint="https://ws1.eastus.inference.ml.azure.com",
        )
        assert r.subscription_id == "sub1"
        assert r.workspace_name == "ws1"


# ---------------------------------------------------------------------------
# GET /azure/foundry-resources
# ---------------------------------------------------------------------------


class TestAzureResourcesRoute:
    def test_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/azure/foundry-resources")
        assert resp.status_code in (401, 403)

    @patch("routers.azure_resources.arm")
    def test_returns_resources(self, mock_arm):
        from services.arm import FoundryResource

        mock_arm.list_foundry_resources = AsyncMock(
            return_value=[
                FoundryResource(
                    subscription_id="sub1",
                    subscription_name="Dev Sub",
                    resource_group="rg-ai",
                    workspace_name="my-workspace",
                    inference_endpoint="https://my-workspace.eastus.inference.ml.azure.com",
                ),
            ]
        )

        client = _make_client()
        resp = client.get("/azure/foundry-resources")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["subscription_id"] == "sub1"
        assert data[0]["workspace_name"] == "my-workspace"
        assert data[0]["inference_endpoint"].startswith("https://")
        mock_arm.list_foundry_resources.assert_called_once_with("fake-bearer-token")

    @patch("routers.azure_resources.arm")
    def test_returns_empty_list(self, mock_arm):
        mock_arm.list_foundry_resources = AsyncMock(return_value=[])
        client = _make_client()
        resp = client.get("/azure/foundry-resources")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("routers.azure_resources.arm")
    def test_arm_failure_returns_502(self, mock_arm):
        mock_arm.list_foundry_resources = AsyncMock(
            side_effect=Exception("ARM unreachable")
        )
        client = _make_client()
        resp = client.get("/azure/foundry-resources")
        assert resp.status_code == 502


# ---------------------------------------------------------------------------
# POST /race/{id}/share
# ---------------------------------------------------------------------------


class TestShareRoutes:
    def test_share_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/race/some-id/share",
            json={"recipient_email": "colleague@org.com"},
        )
        assert resp.status_code in (401, 403)

    @patch("routers.shares.share_repo")
    @patch("routers.shares.graph")
    @patch("routers.shares.race_repo")
    def test_share_race_success(self, mock_race_repo, mock_graph, mock_share_repo):
        mock_race_repo.get_race = AsyncMock(
            return_value={"id": "race1", "user_oid": FAKE_USER_OID}
        )
        mock_graph.resolve_email_to_oid = AsyncMock(
            return_value="00000000-0000-0000-0000-000000000099"
        )
        mock_share_repo.create_share = AsyncMock(return_value={})

        client = _make_client()
        resp = client.post(
            "/race/race1/share",
            json={"recipient_email": "colleague@org.com"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["race_id"] == "race1"
        assert data["owner_oid"] == FAKE_USER_OID
        assert data["recipient_oid"] == "00000000-0000-0000-0000-000000000099"
        assert "shared_at" in data
        mock_share_repo.create_share.assert_called_once()

    @patch("routers.shares.race_repo")
    def test_share_race_not_found(self, mock_race_repo):
        mock_race_repo.get_race = AsyncMock(return_value=None)

        client = _make_client()
        resp = client.post(
            "/race/nonexistent/share",
            json={"recipient_email": "colleague@org.com"},
        )
        assert resp.status_code == 404

    @patch("routers.shares.graph")
    @patch("routers.shares.race_repo")
    def test_share_recipient_not_found(self, mock_race_repo, mock_graph):
        from fastapi import HTTPException

        mock_race_repo.get_race = AsyncMock(
            return_value={"id": "race1", "user_oid": FAKE_USER_OID}
        )
        mock_graph.resolve_email_to_oid = AsyncMock(
            side_effect=HTTPException(status_code=403, detail="Recipient not found")
        )

        client = _make_client()
        resp = client.post(
            "/race/race1/share",
            json={"recipient_email": "unknown@other.com"},
        )
        assert resp.status_code == 403

    # -----------------------------------------------------------------------
    # GET /me/shared
    # -----------------------------------------------------------------------

    def test_shared_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/me/shared")
        assert resp.status_code in (401, 403)

    @patch("routers.shares.share_repo")
    def test_list_shared_with_me(self, mock_share_repo):
        mock_share_repo.list_shared_with_user = AsyncMock(
            return_value=[
                {
                    "id": "share1",
                    "partitionKey": FAKE_USER_OID,
                    "race_id": "race1",
                    "owner_oid": "owner-oid",
                    "owner_name": "Alice",
                    "recipient_oid": FAKE_USER_OID,
                    "shared_at": "2025-01-01T12:00:00Z",
                }
            ]
        )

        client = _make_client()
        resp = client.get("/me/shared")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["race_id"] == "race1"
        mock_share_repo.list_shared_with_user.assert_called_once_with(FAKE_USER_OID)

    @patch("routers.shares.share_repo")
    def test_list_shared_empty(self, mock_share_repo):
        mock_share_repo.list_shared_with_user = AsyncMock(return_value=[])
        client = _make_client()
        resp = client.get("/me/shared")
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /me/history (paginated) + GET /me/history/{id}
# ---------------------------------------------------------------------------


class TestHistoryRoutes:
    def test_history_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/me/history")
        assert resp.status_code in (401, 403)

    @patch("routers.history.race_repo")
    def test_list_history_paginated(self, mock_race_repo):
        races = [
            {
                "id": f"race{i}",
                "user_oid": FAKE_USER_OID,
                "user_input": f"prompt {i}",
                "run_at": "2025-01-01T12:00:00Z",
                "results": [
                    {
                        "model_config_id": "mc1",
                        "label": "GPT-4o",
                        "finish_position": 1,
                        "elapsed_ms": 1500,
                    }
                ],
            }
            for i in range(5)
        ]
        mock_race_repo.list_races = AsyncMock(return_value=races)

        client = _make_client()
        resp = client.get("/me/history", params={"offset": 1, "limit": 2})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 5
        assert data["offset"] == 1
        assert data["limit"] == 2
        assert len(data["items"]) == 2
        assert data["items"][0]["id"] == "race1"
        assert data["items"][1]["id"] == "race2"

    @patch("routers.history.race_repo")
    def test_list_history_default_pagination(self, mock_race_repo):
        mock_race_repo.list_races = AsyncMock(return_value=[])
        client = _make_client()
        resp = client.get("/me/history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["offset"] == 0
        assert data["limit"] == 20
        assert data["items"] == []

    @patch("routers.history.race_repo")
    def test_list_history_metadata_only(self, mock_race_repo):
        """Ensure that response_text is NOT included in list results."""
        mock_race_repo.list_races = AsyncMock(
            return_value=[
                {
                    "id": "race1",
                    "user_oid": FAKE_USER_OID,
                    "user_input": "hello",
                    "run_at": "2025-01-01T12:00:00Z",
                    "results": [
                        {
                            "model_config_id": "mc1",
                            "label": "GPT-4o",
                            "response_text": "This should not appear",
                            "finish_position": 1,
                            "elapsed_ms": 1000,
                        }
                    ],
                }
            ]
        )

        client = _make_client()
        resp = client.get("/me/history")
        assert resp.status_code == 200
        data = resp.json()
        items = data["items"]
        assert len(items) == 1
        # Metadata is present
        assert items[0]["id"] == "race1"
        assert items[0]["result_count"] == 1
        # response_text should not be in the listing
        assert "response_text" not in str(items[0])

    # -----------------------------------------------------------------------
    # GET /me/history/{id}
    # -----------------------------------------------------------------------

    def test_history_detail_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/me/history/some-id")
        assert resp.status_code in (401, 403)

    @patch("routers.history.race_repo")
    def test_get_history_detail(self, mock_race_repo):
        mock_race_repo.get_race = AsyncMock(
            return_value={
                "id": "race1",
                "partitionKey": FAKE_USER_OID,
                "user_oid": FAKE_USER_OID,
                "user_input": "hello",
                "run_at": "2025-01-01T12:00:00Z",
                "results": [
                    {
                        "model_config_id": "mc1",
                        "label": "GPT-4o",
                        "system_prompt": "You are a helper.",
                        "response_text": "Hello there!",
                        "elapsed_ms": 1500.0,
                        "ttft_ms": 200.0,
                        "usage": {
                            "prompt_tokens": 10,
                            "cached_tokens": 0,
                            "completion_tokens": 5,
                        },
                        "finish_position": 1,
                    }
                ],
            }
        )

        client = _make_client()
        resp = client.get("/me/history/race1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "race1"
        assert data["user_input"] == "hello"
        assert len(data["results"]) == 1
        assert data["results"][0]["response_text"] == "Hello there!"
        mock_race_repo.get_race.assert_called_once_with("race1", FAKE_USER_OID)

    @patch("routers.history.race_repo")
    def test_get_history_detail_not_found(self, mock_race_repo):
        mock_race_repo.get_race = AsyncMock(return_value=None)

        client = _make_client()
        resp = client.get("/me/history/nonexistent")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# OpenAPI spec — new endpoints
# ---------------------------------------------------------------------------


class TestOpenAPINewRoutes:
    def test_openapi_has_foundry_resources(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        paths = resp.json().get("paths", {})
        assert "/azure/foundry-resources" in paths
        assert "get" in paths["/azure/foundry-resources"]

    def test_openapi_has_share_route(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        paths = resp.json().get("paths", {})
        assert "/race/{race_id}/share" in paths
        assert "post" in paths["/race/{race_id}/share"]

    def test_openapi_has_shared_route(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        paths = resp.json().get("paths", {})
        assert "/me/shared" in paths
        assert "get" in paths["/me/shared"]

    def test_openapi_has_history_routes(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        paths = resp.json().get("paths", {})
        assert "/me/history" in paths
        assert "get" in paths["/me/history"]
        assert "/me/history/{race_id}" in paths
        assert "get" in paths["/me/history/{race_id}"]
