"""llm-racetrack — FastAPI application entry-point.

This module creates the FastAPI application with CORS, lifespan hooks
(Cosmos DB init/close, model config loading), and a health-check endpoint.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.loader import load_model_defaults, get_model_defaults
from db.cosmos_client import init_cosmos, close_cosmos
from routers import models as models_router
from routers import race as race_router
from settings import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown lifecycle hook."""
    # Startup ------------------------------------------------------------------
    load_model_defaults()
    await init_cosmos()
    # --------------------------------------------------------------------------
    yield
    # Shutdown -----------------------------------------------------------------
    await close_cosmos()


settings = get_settings()

app = FastAPI(
    title="llm-racetrack",
    description="Side-by-side LLM comparison tool — backend API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Routers
# --------------------------------------------------------------------------

app.include_router(models_router.router)
app.include_router(race_router.router)


# --------------------------------------------------------------------------
# Health check (no auth required — used by Azure App Service probes)
# --------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
