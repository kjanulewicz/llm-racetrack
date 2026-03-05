"""Tests for the DEV_MODE mock race endpoint."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, patch

import pytest

from models.schemas import ModelConfig, TokenUsage


# ---------------------------------------------------------------------------
# Mock streamer unit tests
# ---------------------------------------------------------------------------


class TestMockStreamer:
    @pytest.mark.asyncio
    async def test_stream_completion_yields_chunks_and_usage(self):
        from services.mock_streamer import stream_completion

        mc = ModelConfig(
            id="mock-gpt",
            partitionKey="dev",
            user_oid="dev",
            base_model_id="mock-gpt",
            label="Mock GPT",
            provider="mock",
            endpoint_url="https://mock.local",
            created_at="2025-01-01T00:00:00Z",
        )

        chunks = []
        usage = None
        async for text, chunk_usage in stream_completion(mc, "sys", "hello"):
            if chunk_usage is not None:
                usage = chunk_usage
            else:
                chunks.append(text)

        # Should yield 20-40 words
        assert 20 <= len(chunks) <= 40
        # All chunks should be non-empty strings
        assert all(isinstance(c, str) and len(c) > 0 for c in chunks)
        # Final usage should be present
        assert usage is not None
        assert isinstance(usage, TokenUsage)
        assert usage.prompt_tokens == 42
        assert usage.cached_tokens == 0
        assert 20 <= usage.completion_tokens <= 40

    @pytest.mark.asyncio
    async def test_stream_completion_words_from_lorem(self):
        from services.mock_streamer import stream_completion, _LOREM_WORDS

        mc = ModelConfig(
            id="mock-gpt",
            partitionKey="dev",
            user_oid="dev",
            base_model_id="mock-gpt",
            label="Mock GPT",
            provider="mock",
            endpoint_url="https://mock.local",
            created_at="2025-01-01T00:00:00Z",
        )

        async for text, chunk_usage in stream_completion(mc, "", "hi"):
            if chunk_usage is None:
                assert text.strip() in _LOREM_WORDS


# ---------------------------------------------------------------------------
# Race runner — mock provider routing
# ---------------------------------------------------------------------------


class TestRaceRunnerMockProvider:
    @pytest.mark.asyncio
    async def test_run_race_with_mock_models_yields_expected_events(self):
        from services.race_runner import run_race

        mc1 = ModelConfig(
            id="mock-gpt",
            partitionKey="dev",
            user_oid="dev",
            base_model_id="mock-gpt",
            label="Mock GPT",
            provider="mock",
            endpoint_url="https://mock.local",
            created_at="2025-01-01T00:00:00Z",
        )
        mc2 = ModelConfig(
            id="mock-mistral",
            partitionKey="dev",
            user_oid="dev",
            base_model_id="mock-mistral",
            label="Mock Mistral",
            provider="mock",
            endpoint_url="https://mock.local",
            created_at="2025-01-01T00:00:00Z",
        )

        events = []
        with patch("services.race_runner.race_repo") as mock_repo:
            mock_repo.save_race = AsyncMock()
            async for frame in run_race(
                user_oid="dev",
                user_input="hello",
                model_entries=[(mc1, ""), (mc2, "")],
            ):
                events.append(frame)

        # Parse all SSE frames
        parsed = []
        for raw in events:
            for block in raw.strip().split("\n\n"):
                lines = block.strip().split("\n")
                ev_type = lines[0].split(": ", 1)[1]
                ev_data = json.loads(lines[1].split(": ", 1)[1])
                parsed.append((ev_type, ev_data))

        event_types = [e[0] for e in parsed]

        # Should have chunk, ttft, done events for both models
        assert "chunk" in event_types
        assert "ttft" in event_types
        assert "done" in event_types
        assert "race_complete" in event_types

        # Both models should appear
        model_ids_in_chunks = {
            e[1]["model_config_id"] for e in parsed if e[0] == "chunk"
        }
        assert "mock-gpt" in model_ids_in_chunks
        assert "mock-mistral" in model_ids_in_chunks

        # Done events should have usage info
        done_events = [e for e in parsed if e[0] == "done"]
        assert len(done_events) == 2
        for _, data in done_events:
            assert "usage" in data
            assert data["usage"]["prompt_tokens"] == 42
            assert data["usage"]["cached_tokens"] == 0
            assert 20 <= data["usage"]["completion_tokens"] <= 40
            assert data["elapsed_ms"] > 0
            assert data["ttft_ms"] > 0
            assert data["finish_position"] in (1, 2)

    @pytest.mark.asyncio
    async def test_run_race_supports_up_to_4_mock_models(self):
        from services.race_runner import run_race

        models = []
        for i in range(4):
            models.append(
                (
                    ModelConfig(
                        id=f"mock-{i}",
                        partitionKey="dev",
                        user_oid="dev",
                        base_model_id=f"mock-{i}",
                        label=f"Mock {i}",
                        provider="mock",
                        endpoint_url="https://mock.local",
                        created_at="2025-01-01T00:00:00Z",
                    ),
                    "",
                )
            )

        events = []
        with patch("services.race_runner.race_repo") as mock_repo:
            mock_repo.save_race = AsyncMock()
            async for frame in run_race(
                user_oid="dev",
                user_input="hello",
                model_entries=models,
            ):
                events.append(frame)

        # Parse done events
        done_events = []
        for raw in events:
            for block in raw.strip().split("\n\n"):
                lines = block.strip().split("\n")
                ev_type = lines[0].split(": ", 1)[1]
                if ev_type == "done":
                    ev_data = json.loads(lines[1].split(": ", 1)[1])
                    done_events.append(ev_data)

        assert len(done_events) == 4
        positions = sorted(e["finish_position"] for e in done_events)
        assert positions == [1, 2, 3, 4]


# ---------------------------------------------------------------------------
# Race router — DEV_MODE bypass
# ---------------------------------------------------------------------------


class TestRaceRouterDevMode:
    def test_build_mock_model_known_id(self):
        from routers.race import _build_mock_model

        mc = _build_mock_model("mock-gpt")
        assert mc.id == "mock-gpt"
        assert mc.provider == "mock"
        assert mc.label == "Mock GPT"

    def test_build_mock_model_known_id_mistral(self):
        from routers.race import _build_mock_model

        mc = _build_mock_model("mock-mistral")
        assert mc.id == "mock-mistral"
        assert mc.provider == "mock"
        assert mc.label == "Mock Mistral"
        assert mc.color == "#f472b6"

    def test_build_mock_model_unknown_id(self):
        from routers.race import _build_mock_model

        mc = _build_mock_model("custom-model")
        assert mc.id == "custom-model"
        assert mc.provider == "mock"
        assert mc.label == "custom-model"

    def test_default_mock_models_list(self):
        from routers.race import _MOCK_MODELS

        assert len(_MOCK_MODELS) == 2
        ids = {m["id"] for m in _MOCK_MODELS}
        assert ids == {"mock-gpt", "mock-mistral"}
