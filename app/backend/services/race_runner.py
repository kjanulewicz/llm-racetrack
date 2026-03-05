"""Race runner — parallel model orchestrator + SSE event builder.

Fires all model completion calls concurrently via :func:`asyncio.gather`,
yields Server-Sent Events as each model streams, and persists the final
:class:`Race` document to Cosmos DB upon completion.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from models.schemas import (
    ModelConfig,
    Race,
    RaceModelEntry,
    RaceResult,
    TokenUsage,
)
from db.repositories import race_repo
from services import azure_foundry, azure_openai, mock_streamer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


def _sse_event(event: str, data: dict) -> str:
    """Format a single SSE frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Per-model streaming coroutine
# ---------------------------------------------------------------------------


async def _run_single_model(
    model_config: ModelConfig,
    system_prompt: str,
    user_input: str,
    queue: asyncio.Queue,
    finish_order: list[str],
) -> RaceResult:
    """Stream a single model and push SSE-ready events onto *queue*.

    Returns a :class:`RaceResult` once the model finishes.
    """
    config_id = model_config.id
    start = time.perf_counter()
    ttft: float | None = None
    chunks: list[str] = []
    usage = TokenUsage()

    try:
        # Select the right service based on provider
        if model_config.provider == "mock":
            streamer = mock_streamer.stream_completion
        elif model_config.provider == "azure_openai":
            streamer = azure_openai.stream_completion
        else:
            streamer = azure_foundry.stream_completion

        async for text, chunk_usage in streamer(
            model_config, system_prompt, user_input
        ):
            now = time.perf_counter()

            if chunk_usage is not None:
                usage = chunk_usage
                continue

            if text:
                if ttft is None:
                    ttft = (now - start) * 1000  # ms
                    await queue.put(
                        _sse_event(
                            "ttft",
                            {
                                "model_config_id": config_id,
                                "ttft_ms": round(ttft, 2),
                            },
                        )
                    )
                chunks.append(text)
                await queue.put(
                    _sse_event(
                        "chunk",
                        {
                            "model_config_id": config_id,
                            "text": text,
                        },
                    )
                )

    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        await queue.put(
            _sse_event(
                "error",
                {
                    "model_config_id": config_id,
                    "error": str(exc),
                },
            )
        )
        return RaceResult(
            model_config_id=config_id,
            label=model_config.label,
            system_prompt=system_prompt,
            response_text="",
            elapsed_ms=round(elapsed, 2),
            ttft_ms=round(ttft or 0, 2),
            usage=usage,
            finish_position=0,  # will be assigned later
        )

    elapsed = (time.perf_counter() - start) * 1000
    finish_order.append(config_id)
    position = len(finish_order)

    await queue.put(
        _sse_event(
            "done",
            {
                "model_config_id": config_id,
                "elapsed_ms": round(elapsed, 2),
                "ttft_ms": round(ttft or 0, 2),
                "usage": usage.model_dump(),
                "finish_position": position,
            },
        )
    )

    return RaceResult(
        model_config_id=config_id,
        label=model_config.label,
        system_prompt=system_prompt,
        response_text="".join(chunks),
        elapsed_ms=round(elapsed, 2),
        ttft_ms=round(ttft or 0, 2),
        usage=usage,
        finish_position=position,
    )


# ---------------------------------------------------------------------------
# Public orchestrator
# ---------------------------------------------------------------------------


async def run_race(
    user_oid: str,
    user_input: str,
    model_entries: list[tuple[ModelConfig, str]],
) -> AsyncIterator[str]:
    """Run a parallel race and yield SSE frames.

    Parameters
    ----------
    user_oid:
        Authenticated user's Entra object ID.
    user_input:
        The user's prompt text.
    model_entries:
        List of ``(ModelConfig, system_prompt)`` tuples — one per racer.

    Yields
    ------
    str
        Formatted SSE frames (``event: …\\ndata: …\\n\\n``).
    """
    queue: asyncio.Queue[str | None] = asyncio.Queue()
    finish_order: list[str] = []

    race_id = str(uuid.uuid4())

    async def _gather() -> list[RaceResult]:
        """Run all models and signal completion via a sentinel."""
        results = await asyncio.gather(
            *(
                _run_single_model(mc, sp, user_input, queue, finish_order)
                for mc, sp in model_entries
            )
        )
        await queue.put(None)  # sentinel
        return list(results)

    gather_task = asyncio.create_task(_gather())

    # Drain events from the queue as they arrive
    while True:
        event = await queue.get()
        if event is None:
            break
        yield event

    results = await gather_task

    # Persist the race to Cosmos DB
    race_doc = Race(
        id=race_id,
        partitionKey=user_oid,
        user_oid=user_oid,
        user_input=user_input,
        run_at=datetime.now(timezone.utc),
        results=results,
    )
    try:
        await race_repo.save_race(race_doc.model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to persist race %s to Cosmos DB", race_id)

    # Final event with race_id so the frontend can reference it
    yield _sse_event(
        "race_complete",
        {"race_id": race_id},
    )
