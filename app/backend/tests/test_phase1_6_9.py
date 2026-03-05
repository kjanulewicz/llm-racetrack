"""Tests for Phase 1 tasks 1.6–1.9.

Validates:
- JWT validator module structure and UserClaims
- Azure OpenAI service module interface
- Azure AI Foundry service module interface
- Race runner module interface
- Pydantic request/response schemas
- API routes (models + race) via TestClient with auth mocking
- File structure for new modules
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
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


# ---------------------------------------------------------------------------
# Project structure
# ---------------------------------------------------------------------------

class TestProjectStructurePhase1_6_9:
    @pytest.mark.parametrize(
        "rel_path",
        [
            "auth/jwt_validator.py",
            "services/azure_openai.py",
            "services/azure_foundry.py",
            "services/race_runner.py",
            "routers/models.py",
            "routers/race.py",
        ],
    )
    def test_file_exists(self, rel_path: str):
        assert (BACKEND_ROOT / rel_path).exists(), f"Missing: {rel_path}"


# ---------------------------------------------------------------------------
# JWT validator / UserClaims
# ---------------------------------------------------------------------------

class TestJwtValidator:
    def test_user_claims_dataclass(self):
        from auth.jwt_validator import UserClaims

        uc = UserClaims(oid="abc", email="a@b.com", name="Alice")
        assert uc.oid == "abc"
        assert uc.email == "a@b.com"
        assert uc.name == "Alice"

    def test_user_claims_frozen(self):
        from auth.jwt_validator import UserClaims

        uc = UserClaims(oid="abc", email="a@b.com", name="Alice")
        with pytest.raises(AttributeError):
            uc.oid = "new"  # type: ignore[misc]

    def test_get_current_user_is_callable(self):
        from auth.jwt_validator import get_current_user
        assert callable(get_current_user)

    def test_oauth2_scheme_exists(self):
        from auth.jwt_validator import oauth2_scheme
        assert oauth2_scheme is not None


# ---------------------------------------------------------------------------
# New Pydantic schemas
# ---------------------------------------------------------------------------

class TestNewSchemas:
    def test_race_request(self):
        from models.schemas import RaceRequest, RaceModelEntry

        rr = RaceRequest(
            user_input="Hello",
            models=[
                RaceModelEntry(model_config_id="a", system_prompt="sys1"),
                RaceModelEntry(model_config_id="b", system_prompt="sys2"),
            ],
        )
        assert rr.user_input == "Hello"
        assert len(rr.models) == 2

    def test_race_request_min_models(self):
        from models.schemas import RaceRequest, RaceModelEntry
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RaceRequest(
                user_input="Hello",
                models=[RaceModelEntry(model_config_id="a")],
            )

    def test_race_request_max_models(self):
        from models.schemas import RaceRequest, RaceModelEntry
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RaceRequest(
                user_input="Hello",
                models=[
                    RaceModelEntry(model_config_id=str(i))
                    for i in range(5)
                ],
            )

    def test_model_config_create(self):
        from models.schemas import ModelConfigCreate

        mc = ModelConfigCreate(
            base_model_id="gpt-4o",
            label="GPT-4o",
            provider="azure_openai",
        )
        assert mc.color == "#38bdf8"
        assert mc.endpoint_url is None

    def test_race_model_entry_default_prompt(self):
        from models.schemas import RaceModelEntry

        entry = RaceModelEntry(model_config_id="abc")
        assert entry.system_prompt == ""


# ---------------------------------------------------------------------------
# Services — module interface
# ---------------------------------------------------------------------------

class TestServiceModules:
    def test_azure_openai_has_stream_completion(self):
        from services import azure_openai
        assert hasattr(azure_openai, "stream_completion")
        assert callable(azure_openai.stream_completion)

    def test_azure_foundry_has_stream_completion(self):
        from services import azure_foundry
        assert hasattr(azure_foundry, "stream_completion")
        assert callable(azure_foundry.stream_completion)

    def test_race_runner_has_run_race(self):
        from services import race_runner
        assert hasattr(race_runner, "run_race")
        assert callable(race_runner.run_race)

    def test_race_runner_sse_event_helper(self):
        from services.race_runner import _sse_event

        event = _sse_event("chunk", {"model_config_id": "a", "text": "hi"})
        assert event.startswith("event: chunk\n")
        assert '"model_config_id": "a"' in event
        assert event.endswith("\n\n")


# ---------------------------------------------------------------------------
# API routes — GET /models/defaults (no auth)
# ---------------------------------------------------------------------------

class TestModelsDefaultsRoute:
    def test_get_defaults_returns_list(self):
        from config.loader import load_model_defaults
        from main import app

        # Ensure defaults are loaded (lifespan may not run in TestClient)
        load_model_defaults()

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/models/defaults")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all("id" in m for m in data)
        assert all("provider" in m for m in data)


# ---------------------------------------------------------------------------
# API routes — /me/models (auth required)
# ---------------------------------------------------------------------------

class TestUserModelRoutes:
    """Test model config CRUD routes with auth mocked."""

    def _make_client(self) -> TestClient:
        """Build a TestClient with get_current_user overridden."""
        from main import app
        from auth.jwt_validator import get_current_user

        app.dependency_overrides[get_current_user] = lambda: _get_fake_user()
        return TestClient(app, raise_server_exceptions=False)

    def test_get_me_models_requires_auth(self):
        """Without auth override, the endpoint rejects the request."""
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/me/models")
        # Expect 401 or 403 since no token is provided
        assert resp.status_code in (401, 403)

    @patch("routers.models.model_config_repo")
    def test_get_me_models(self, mock_repo):
        mock_repo.list_configs = AsyncMock(return_value=[])
        client = self._make_client()
        resp = client.get("/me/models")
        assert resp.status_code == 200
        assert resp.json() == []
        mock_repo.list_configs.assert_called_once_with(FAKE_USER_OID)

    @patch("routers.models.model_config_repo")
    def test_post_me_models(self, mock_repo):
        mock_repo.upsert_config = AsyncMock(return_value={})
        client = self._make_client()
        resp = client.post(
            "/me/models",
            json={
                "base_model_id": "gpt-4o",
                "label": "GPT-4o",
                "provider": "azure_openai",
                "endpoint_url": "https://my-oai.openai.azure.com",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["base_model_id"] == "gpt-4o"
        assert data["user_oid"] == FAKE_USER_OID
        assert "id" in data
        mock_repo.upsert_config.assert_called_once()

    @patch("routers.models.model_config_repo")
    def test_post_foundry_model_requires_https(self, mock_repo):
        client = self._make_client()
        resp = client.post(
            "/me/models",
            json={
                "base_model_id": "mistral-large",
                "label": "Mistral Large",
                "provider": "azure_foundry",
                "endpoint_url": "http://not-https.example.com",
            },
        )
        assert resp.status_code == 422

    @patch("routers.models.model_config_repo")
    def test_post_foundry_model_missing_url(self, mock_repo):
        client = self._make_client()
        resp = client.post(
            "/me/models",
            json={
                "base_model_id": "mistral-large",
                "label": "Mistral Large",
                "provider": "azure_foundry",
            },
        )
        assert resp.status_code == 422

    @patch("routers.models.model_config_repo")
    def test_delete_me_models(self, mock_repo):
        mock_repo.get_config = AsyncMock(return_value={"id": "abc", "partitionKey": FAKE_USER_OID})
        mock_repo.delete_config = AsyncMock(return_value=None)
        client = self._make_client()
        resp = client.delete("/me/models/abc")
        assert resp.status_code == 204
        mock_repo.delete_config.assert_called_once_with("abc", FAKE_USER_OID)

    @patch("routers.models.model_config_repo")
    def test_delete_me_models_not_found(self, mock_repo):
        mock_repo.get_config = AsyncMock(return_value=None)
        client = self._make_client()
        resp = client.delete("/me/models/nonexistent")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# API routes — POST /race (auth required)
# ---------------------------------------------------------------------------

class TestRaceRoute:
    def test_post_race_requires_auth(self):
        from main import app

        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/race",
            json={
                "user_input": "Hello",
                "models": [
                    {"model_config_id": "a", "system_prompt": "sys"},
                    {"model_config_id": "b", "system_prompt": "sys"},
                ],
            },
        )
        assert resp.status_code in (401, 403)

    @patch("routers.race.model_config_repo")
    def test_post_race_config_not_found(self, mock_repo):
        from main import app
        from auth.jwt_validator import get_current_user

        app.dependency_overrides[get_current_user] = lambda: _get_fake_user()
        mock_repo.get_config = AsyncMock(return_value=None)

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/race",
            json={
                "user_input": "Hello",
                "models": [
                    {"model_config_id": "missing1", "system_prompt": "sys"},
                    {"model_config_id": "missing2", "system_prompt": "sys"},
                ],
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Race runner — unit test (mocked services)
# ---------------------------------------------------------------------------

class TestRaceRunner:
    @pytest.mark.asyncio
    async def test_run_race_yields_events(self):
        """Verify that run_race produces SSE events."""
        from models.schemas import ModelConfig, TokenUsage
        from services import race_runner

        now = datetime.now(timezone.utc)
        mc1 = ModelConfig(
            id="mc1",
            partitionKey=FAKE_USER_OID,
            user_oid=FAKE_USER_OID,
            base_model_id="gpt-4o",
            label="GPT-4o",
            provider="azure_openai",
            endpoint_url="https://fake.openai.azure.com",
            created_at=now,
        )
        mc2 = ModelConfig(
            id="mc2",
            partitionKey=FAKE_USER_OID,
            user_oid=FAKE_USER_OID,
            base_model_id="mistral-large",
            label="Mistral Large",
            provider="azure_foundry",
            endpoint_url="https://fake.inference.ai.azure.com",
            created_at=now,
        )

        async def fake_stream(mc, sp, ui):
            yield "Hello ", None
            yield "World", None
            yield "", TokenUsage(prompt_tokens=10, cached_tokens=0, completion_tokens=5)

        with patch.object(race_runner.azure_openai, "stream_completion", side_effect=fake_stream), \
             patch.object(race_runner.azure_foundry, "stream_completion", side_effect=fake_stream), \
             patch.object(race_runner.race_repo, "save_race", new_callable=AsyncMock):

            events: list[str] = []
            async for event in race_runner.run_race(
                user_oid=FAKE_USER_OID,
                user_input="Test prompt",
                model_entries=[(mc1, "sys1"), (mc2, "sys2")],
            ):
                events.append(event)

            # Should have chunk, ttft, done, and race_complete events
            event_text = "".join(events)
            assert "event: chunk" in event_text
            assert "event: ttft" in event_text
            assert "event: done" in event_text
            assert "event: race_complete" in event_text
            assert '"race_id"' in event_text

    @pytest.mark.asyncio
    async def test_run_race_handles_error(self):
        """Verify that a model error produces an error SSE event."""
        from models.schemas import ModelConfig
        from services import race_runner

        now = datetime.now(timezone.utc)
        mc = ModelConfig(
            id="mc_err",
            partitionKey=FAKE_USER_OID,
            user_oid=FAKE_USER_OID,
            base_model_id="gpt-4o",
            label="GPT-4o",
            provider="azure_openai",
            endpoint_url="https://fake.openai.azure.com",
            created_at=now,
        )
        mc2 = ModelConfig(
            id="mc_ok",
            partitionKey=FAKE_USER_OID,
            user_oid=FAKE_USER_OID,
            base_model_id="gpt-4o-mini",
            label="GPT-4o mini",
            provider="azure_openai",
            endpoint_url="https://fake.openai.azure.com",
            created_at=now,
        )

        async def fake_error_stream(mc, sp, ui):
            raise RuntimeError("API failure")
            yield  # pragma: no cover — make it an async generator

        async def fake_ok_stream(mc, sp, ui):
            from models.schemas import TokenUsage
            yield "OK", None
            yield "", TokenUsage(prompt_tokens=5, cached_tokens=0, completion_tokens=2)

        def side_effect_fn(mc, sp, ui):
            if mc.id == "mc_err":
                return fake_error_stream(mc, sp, ui)
            return fake_ok_stream(mc, sp, ui)

        with patch.object(race_runner.azure_openai, "stream_completion", side_effect=side_effect_fn), \
             patch.object(race_runner.race_repo, "save_race", new_callable=AsyncMock):

            events: list[str] = []
            async for event in race_runner.run_race(
                user_oid=FAKE_USER_OID,
                user_input="Test prompt",
                model_entries=[(mc, "sys1"), (mc2, "sys2")],
            ):
                events.append(event)

            event_text = "".join(events)
            assert "event: error" in event_text
            assert "event: race_complete" in event_text


# ---------------------------------------------------------------------------
# OpenAPI spec includes new routes
# ---------------------------------------------------------------------------

class TestOpenAPIRoutes:
    def test_openapi_has_race_route(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        data = resp.json()
        paths = data.get("paths", {})
        assert "/race" in paths
        assert "post" in paths["/race"]

    def test_openapi_has_models_defaults_route(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        data = resp.json()
        paths = data.get("paths", {})
        assert "/models/defaults" in paths
        assert "get" in paths["/models/defaults"]

    def test_openapi_has_me_models_routes(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        data = resp.json()
        paths = data.get("paths", {})
        assert "/me/models" in paths
        assert "get" in paths["/me/models"]
        assert "post" in paths["/me/models"]
