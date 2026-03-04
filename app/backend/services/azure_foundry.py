"""Azure AI Foundry streaming completion service.

Provides an async generator :func:`stream_completion` with the same
interface as :mod:`services.azure_openai`.  Uses the ``azure-ai-inference``
SDK and ``DefaultAzureCredential`` for authentication.
"""

from __future__ import annotations

from typing import AsyncIterator, Optional

from azure.ai.inference.aio import ChatCompletionsClient
from azure.ai.inference.models import (
    StreamingChatCompletionsUpdate,
    SystemMessage,
    UserMessage,
)

from auth.credentials import get_azure_credential
from models.schemas import ModelConfig, TokenUsage


def _build_client(endpoint_url: str) -> ChatCompletionsClient:
    """Create an :class:`ChatCompletionsClient` for the given Foundry endpoint."""
    credential = get_azure_credential()
    return ChatCompletionsClient(endpoint=endpoint_url, credential=credential)


async def stream_completion(
    model_config: ModelConfig,
    system_prompt: str,
    user_input: str,
) -> AsyncIterator[tuple[str, Optional[TokenUsage]]]:
    """Stream a chat completion from Azure AI Foundry.

    Yields ``(chunk_text, None)`` for intermediate chunks and
    ``("", TokenUsage(...))`` for the final usage-bearing chunk.

    Parameters
    ----------
    model_config:
        The user's saved model configuration (must include ``endpoint_url``).
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

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(UserMessage(content=user_input))

    client = _build_client(endpoint)

    try:
        response = await client.complete(
            messages=messages,
            model=model_config.base_model_id,
            stream=True,
        )

        async for update in response:
            # Usage information (typically on the final chunk)
            if update.usage is not None:
                usage = TokenUsage(
                    prompt_tokens=update.usage.prompt_tokens or 0,
                    cached_tokens=0,
                    completion_tokens=update.usage.completion_tokens or 0,
                )
                yield "", usage
                continue

            # Content delta
            if update.choices:
                delta = update.choices[0].delta
                text = delta.content if delta and delta.content else ""
                if text:
                    yield text, None
    finally:
        await client.close()
