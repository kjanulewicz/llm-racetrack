"""Tests for the DEV_MODE bypass feature."""

from __future__ import annotations

import logging
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class TestDevModeSettings:
    def test_dev_mode_defaults_to_false(self):
        from settings import Settings

        s = Settings(
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        assert s.DEV_MODE is False

    def test_environment_defaults_to_local(self):
        from settings import Settings

        s = Settings(
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        assert s.ENVIRONMENT == "local"

    def test_dev_mode_can_be_enabled(self):
        from settings import Settings

        s = Settings(
            DEV_MODE=True,
            ENVIRONMENT="local",
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        assert s.DEV_MODE is True


# ---------------------------------------------------------------------------
# JWT validator — DEV_MODE bypass
# ---------------------------------------------------------------------------

class TestDevModeJwtBypass:
    def test_dev_mode_returns_mock_user(self):
        """When DEV_MODE is True, get_current_user returns the mock user."""
        from auth.jwt_validator import UserClaims, _DEV_USER

        assert _DEV_USER.oid == "00000000-0000-0000-0000-000000000000"
        assert _DEV_USER.email == "dev@localhost"
        assert _DEV_USER.name == "Local Developer"

    @pytest.mark.asyncio
    async def test_get_current_user_returns_dev_user_when_dev_mode(self):
        """get_current_user should return _DEV_USER when DEV_MODE=True."""
        from settings import Settings

        dev_settings = Settings(
            DEV_MODE=True,
            ENVIRONMENT="local",
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        with patch("auth.jwt_validator.get_settings", return_value=dev_settings):
            from auth.jwt_validator import get_current_user, _DEV_USER

            result = await get_current_user(token=None)
            assert result is _DEV_USER


# ---------------------------------------------------------------------------
# Startup validation — DEV_MODE + non-local ENVIRONMENT
# ---------------------------------------------------------------------------

class TestDevModeStartupValidation:
    def test_dev_mode_with_non_local_env_raises(self):
        """DEV_MODE=True with ENVIRONMENT != 'local' must raise RuntimeError."""
        from settings import Settings

        bad_settings = Settings(
            DEV_MODE=True,
            ENVIRONMENT="production",
            TENANT_ID="t",
            API_CLIENT_ID="c",
            COSMOS_URL="https://example.documents.azure.com",
        )
        with patch("main.get_settings", return_value=bad_settings):
            from main import app
            from fastapi.testclient import TestClient

            with pytest.raises(RuntimeError, match="ENVIRONMENT=local"):
                with TestClient(app):
                    pass

    def test_dev_mode_with_local_env_logs_warning(self, caplog):
        """DEV_MODE=True with ENVIRONMENT=local should log a warning."""
        from settings import Settings

        dev_settings = Settings(
            DEV_MODE=True,
            ENVIRONMENT="local",
            TENANT_ID="",
            API_CLIENT_ID="",
            COSMOS_URL="",
        )
        with (
            patch("main.get_settings", return_value=dev_settings),
            patch("main.init_cosmos"),
            patch("main.close_cosmos"),
            caplog.at_level(logging.WARNING),
        ):
            from main import app
            from fastapi.testclient import TestClient

            with TestClient(app):
                pass

        assert any(
            "DEV_MODE enabled" in record.message for record in caplog.records
        )
