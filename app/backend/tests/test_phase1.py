"""Tests for the Phase 1 backend foundation (tasks 1.1–1.5)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class TestSettings:
    def test_defaults(self):
        from settings import Settings

        s = Settings(
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        assert s.FRONTEND_ORIGIN == "http://localhost:5173"
        assert s.MODELS_CONFIG_PATH == "config/models.config.json"

    def test_get_settings_returns_instance(self):
        from settings import get_settings

        s = get_settings()
        assert hasattr(s, "TENANT_ID")


# ---------------------------------------------------------------------------
# Azure credential singleton
# ---------------------------------------------------------------------------

class TestCredentials:
    def test_get_azure_credential_returns_same_instance(self):
        from auth.credentials import get_azure_credential

        c1 = get_azure_credential()
        c2 = get_azure_credential()
        assert c1 is c2

    def test_credential_type(self):
        from auth.credentials import get_azure_credential
        from azure.identity import DefaultAzureCredential

        c = get_azure_credential()
        assert isinstance(c, DefaultAzureCredential)


# ---------------------------------------------------------------------------
# Model config loader
# ---------------------------------------------------------------------------

class TestModelConfigLoader:
    def test_load_model_defaults(self):
        from config.loader import load_model_defaults

        defaults = load_model_defaults()
        assert len(defaults) >= 1
        assert all(hasattr(m, "id") for m in defaults)
        assert all(hasattr(m, "provider") for m in defaults)

    def test_get_model_defaults_returns_loaded(self):
        from config.loader import load_model_defaults, get_model_defaults

        load_model_defaults()
        defaults = get_model_defaults()
        assert len(defaults) >= 1

    def test_models_config_json_valid(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "models.config.json"
        with open(config_path) as f:
            data = json.load(f)
        assert isinstance(data, list)
        for entry in data:
            assert "id" in entry
            assert "name" in entry
            assert "provider" in entry
            assert entry["provider"] in ("azure_openai", "azure_foundry")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class TestSchemas:
    def test_default_model(self):
        from models.schemas import DefaultModel

        m = DefaultModel(id="test", name="Test Model", provider="azure_openai")
        assert m.description == ""
        assert m.default_endpoint_url is None

    def test_model_config(self):
        from models.schemas import ModelConfig

        mc = ModelConfig(
            id="abc",
            partitionKey="user1",
            user_oid="user1",
            base_model_id="gpt-4o",
            label="GPT-4o",
            provider="azure_openai",
            created_at="2025-01-01T00:00:00Z",
        )
        assert mc.color == "#38bdf8"
        assert mc.endpoint_url is None

    def test_token_usage(self):
        from models.schemas import TokenUsage

        u = TokenUsage()
        assert u.prompt_tokens == 0
        assert u.cached_tokens == 0
        assert u.completion_tokens == 0


# ---------------------------------------------------------------------------
# Cosmos client — unit-level (no live connection)
# ---------------------------------------------------------------------------

class TestCosmosClient:
    def test_database_name(self):
        from db.cosmos_client import DATABASE_NAME

        assert DATABASE_NAME == "llm_racetrack"

    def test_container_names(self):
        from db.cosmos_client import (
            CONTAINER_USERS,
            CONTAINER_MODEL_CONFIGS,
            CONTAINER_PROMPT_TEMPLATES,
            CONTAINER_RACES,
            CONTAINER_SHARES,
        )

        assert CONTAINER_USERS == "users"
        assert CONTAINER_MODEL_CONFIGS == "model_configs"
        assert CONTAINER_PROMPT_TEMPLATES == "prompt_templates"
        assert CONTAINER_RACES == "races"
        assert CONTAINER_SHARES == "shares"

    def test_get_database_raises_before_init(self):
        from db import cosmos_client

        # Reset module state to simulate uninitialised client
        original = cosmos_client._database
        cosmos_client._database = None
        try:
            with pytest.raises(RuntimeError, match="not initialised"):
                cosmos_client.get_database()
        finally:
            cosmos_client._database = original


# ---------------------------------------------------------------------------
# FastAPI app — health endpoint
# ---------------------------------------------------------------------------

class TestApp:
    def test_health_endpoint(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_openapi_available(self):
        from main import app

        client = TestClient(app)
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["info"]["title"] == "llm-racetrack"


# ---------------------------------------------------------------------------
# Directory structure — ensure all expected modules exist
# ---------------------------------------------------------------------------

class TestProjectStructure:
    BACKEND_ROOT = Path(__file__).resolve().parent.parent

    @pytest.mark.parametrize(
        "rel_path",
        [
            "main.py",
            "settings.py",
            "requirements.txt",
            ".env.example",
            "auth/__init__.py",
            "auth/credentials.py",
            "db/__init__.py",
            "db/cosmos_client.py",
            "db/repositories/__init__.py",
            "db/repositories/user_repo.py",
            "db/repositories/model_config_repo.py",
            "db/repositories/prompt_repo.py",
            "db/repositories/race_repo.py",
            "db/repositories/share_repo.py",
            "config/models.config.json",
            "config/loader.py",
            "models/__init__.py",
            "models/schemas.py",
            "routers/__init__.py",
            "services/__init__.py",
        ],
    )
    def test_file_exists(self, rel_path: str):
        assert (self.BACKEND_ROOT / rel_path).exists(), f"Missing: {rel_path}"
