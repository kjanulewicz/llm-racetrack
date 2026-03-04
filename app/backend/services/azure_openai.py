"""Azure OpenAI streaming completion service.

Provides an async generator :func:`stream_completion` that yields
``(chunk_text, usage | None)`` tuples as the model streams its response.
Authentication uses ``DefaultAzureCredential`` to obtain a token for the
Azure Cognitive Services scope.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional

from openai import AsyncAzureOpenAI

from auth.credentials import get_azure_credential
from models.schemas import ModelConfig, TokenUsage


# Azure Cognitive Services token scope required by Azure OpenAI
_SCOPE = "https://cognitiveservices.azure.com/.default"


def _build_client(endpoint_url: str) -> AsyncAzureOpenAI:
    """Create an :class:`AsyncAzureOpenAI` client for the given endpoint."""
    credential = get_azure_credential()
    return AsyncAzureOpenAI(
        azure_endpoint=endpoint_url,
        azure_ad_token_provider=lambda: credential.get_token(_SCOPE).token,
        api_version="2024-06-01",
    )


async def stream_completion(
    model_config: ModelConfig,
    system_prompt: str,
    user_input: str,
) -> AsyncIterator[tuple[str, Optional[TokenUsage]]]:
    """Stream a chat completion from Azure OpenAI.

    Yields ``(chunk_text, None)`` for intermediate chunks and
    ``("", TokenUsage(...))`` for the final usage-bearing chunk.

    Parameters
    ----------
    model_config:
        The user's saved model configuration (must include ``endpoint_url``
        or fall back to the base model's default endpoint).
    system_prompt:
        The system message to prepend to the conversation.
    user_input:
        The user's prompt text.
    """
    endpoint = model_config.endpoint_url or ""
    if not endpoint:
        raise ValueError(
            f"No endpoint_url configured for model {model_config.label!r}"
        )

    client = _build_client(endpoint)

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_input})

    try:
        stream = await client.chat.completions.create(
            model=model_config.base_model_id,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )

        async for chunk in stream:
            # Usage-only final chunk
            if chunk.usage is not None:
                usage = TokenUsage(
                    prompt_tokens=chunk.usage.prompt_tokens or 0,
                    cached_tokens=getattr(
                        chunk.usage, "cached_tokens", 0
                    )
                    or 0,
                    completion_tokens=chunk.usage.completion_tokens or 0,
                )
                yield "", usage
                continue

            # Content delta
            if chunk.choices:
                delta = chunk.choices[0].delta
                text = delta.content if delta and delta.content else ""
                if text:
                    yield text, None
    finally:
        await client.close()
