"""Org-wide default model configuration loader.

Reads ``models.config.json`` at startup and exposes the parsed list.  The file
path is configured via ``Settings.MODELS_CONFIG_PATH``.
"""

from __future__ import annotations

import json
from pathlib import Path

from models.schemas import DefaultModel
from settings import get_settings

_defaults: list[DefaultModel] = []


def load_model_defaults() -> list[DefaultModel]:
    """Read and parse the models config JSON file.

    Called once during application startup.  Subsequent access should use
    :func:`get_model_defaults`.
    """
    global _defaults
    settings = get_settings()
    config_path = Path(settings.MODELS_CONFIG_PATH)
    if not config_path.is_absolute():
        # Resolve relative to the backend package root
        config_path = Path(__file__).resolve().parent.parent / config_path
    with open(config_path, encoding="utf-8") as fh:
        raw = json.load(fh)
    _defaults = [DefaultModel(**entry) for entry in raw]
    return _defaults


def get_model_defaults() -> list[DefaultModel]:
    """Return the previously-loaded default model list."""
    return _defaults
