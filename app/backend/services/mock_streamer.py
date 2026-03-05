"""Mock streaming completion service for DEV_MODE.

Provides an async generator :func:`stream_completion` with the same interface
as :mod:`services.azure_openai` and :mod:`services.azure_foundry`.  Instead of
calling any Azure AI service it yields random lorem-ipsum words with small
random delays, making the race animation work without real credentials.
"""

from __future__ import annotations

import asyncio
import random
from typing import AsyncIterator, Optional

from models.schemas import ModelConfig, TokenUsage

_LOREM_WORDS: list[str] = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur",
    "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
    "incididunt", "ut", "labore", "et", "dolore", "magna",
    "aliqua", "enim", "ad", "minim", "veniam", "quis",
    "nostrud", "exercitation", "ullamco", "laboris", "nisi",
    "aliquip", "ex", "ea", "commodo", "consequat", "duis",
    "aute", "irure", "in", "reprehenderit", "voluptate",
    "velit", "esse", "cillum", "fugiat", "nulla", "pariatur",
    "excepteur", "sint", "occaecat", "cupidatat",
]


async def stream_completion(
    model_config: ModelConfig,
    system_prompt: str,
    user_input: str,
) -> AsyncIterator[tuple[str, Optional[TokenUsage]]]:
    """Yield fake streaming chunks followed by a usage summary.

    Yields ``(word, None)`` for 20-40 random lorem-ipsum words (each preceded
    by a 100-300 ms delay) and finally ``("", TokenUsage(...))`` with
    realistic fake values.
    """
    num_words = random.randint(20, 40)
    words = random.choices(_LOREM_WORDS, k=num_words)

    for i, word in enumerate(words):
        await asyncio.sleep(random.uniform(0.1, 0.3))
        prefix = "" if i == 0 else " "
        yield prefix + word, None

    # Final usage chunk
    yield "", TokenUsage(
        prompt_tokens=42,
        cached_tokens=0,
        completion_tokens=num_words,
    )
