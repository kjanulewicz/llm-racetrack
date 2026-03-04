"""Application settings loaded from environment variables via pydantic-settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration.

    All values are loaded from environment variables (or an ``.env`` file when
    present).  None of the values are secrets — Azure authentication is handled
    entirely through ``DefaultAzureCredential``.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Azure Entra ID (single-tenant)
    TENANT_ID: str = ""
    API_CLIENT_ID: str = ""

    # Azure Cosmos DB
    COSMOS_URL: str = ""

    # CORS — the frontend origin allowed to call the API
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Path to the org-wide default model definitions (relative to app root)
    MODELS_CONFIG_PATH: str = "config/models.config.json"


def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance."""
    return _settings


_settings = Settings()
