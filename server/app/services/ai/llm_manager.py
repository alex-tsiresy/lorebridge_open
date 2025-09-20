"""
LLM Manager service for handling multiple AI providers.

This service provides a unified interface for different LLM providers
like OpenAI, with support for chat completions and streaming.
"""

from collections.abc import Generator
import time
from typing import Any

from app.core.config import settings
from app.core.logger import logger
from app.services.interfaces import AIProviderInterface
from app.services.providers.openai import OpenAIProvider
from app.services.metrics import LLM_CALLS, LLM_ERRORS, LLM_LATENCY, LLM_TOKENS

# Registry of available LLM providers
_PROVIDER_REGISTRY: dict[str, type[AIProviderInterface]] = {
    "openai": OpenAIProvider,
}


class LLMManager:
    """
    Manager for coordinating multiple LLM providers.

    Provides a unified interface for chat completions and streaming
    across different AI providers with automatic provider selection.
    """

    def __init__(self, default: str = "openai") -> None:
        """
        Initialize LLM manager with default provider.

        Args:
            default: Name of the default provider to use
        """
        self.default = default
        self._instances: dict[str, AIProviderInterface] = {}

    def get(self, provider_name: str | None = None) -> AIProviderInterface:
        """
        Get an instance of the specified provider.

        Args:
            provider_name: Name of the provider, defaults to self.default

        Returns:
            Configured provider instance

        Raises:
            ValueError: If provider is not registered
        """
        provider_name = provider_name or self.default
        if provider_name not in self._instances:
            if provider_name not in _PROVIDER_REGISTRY:
                raise ValueError(f"Unknown provider: {provider_name}")
            self._instances[provider_name] = _PROVIDER_REGISTRY[provider_name]()
        return self._instances[provider_name]

    def chat(self, *args: Any, provider: str | None = None, **kwargs: Any) -> str:
        """
        Generate a chat completion using specified provider.

        Args:
            *args: Positional arguments passed to provider
            provider: Provider name, defaults to self.default
            **kwargs: Keyword arguments passed to provider

        Returns:
            Generated text response

        Raises:
            Exception: If chat generation fails
        """
        provider_name = provider or self.default
        logger.info(
            "LLM Manager: Calling chat",
            extra={"provider": provider_name, "operation": "chat"},
        )

        model_label = str(kwargs.get("model", "unknown"))
        start_time = time.time()
        try:
            LLM_CALLS.labels(model_label, provider_name, "chat").inc()
            result = self.get(provider).chat(*args, **kwargs)
            duration = time.time() - start_time
            LLM_LATENCY.labels(model_label, provider_name, "chat").observe(duration)

            # Best-effort token extraction (OpenAI responses API exposes usage)
            try:
                usage = getattr(result, "usage", None)
                if usage is not None:
                    # OpenAI responses: input_tokens, output_tokens
                    input_tokens = getattr(usage, "input_tokens", None)
                    if isinstance(input_tokens, (int, float)):
                        LLM_TOKENS.labels(model_label, provider_name, "prompt").inc(
                            input_tokens
                        )
                    output_tokens = getattr(usage, "output_tokens", None)
                    if isinstance(output_tokens, (int, float)):
                        LLM_TOKENS.labels(
                            model_label, provider_name, "completion"
                        ).inc(output_tokens)
            except Exception:
                # Do not let metric extraction impact main flow
                pass
            logger.info(
                "LLM Manager: Chat call successful", extra={"provider": provider_name}
            )
            return result
        except Exception as e:
            LLM_ERRORS.labels(model_label, provider_name, e.__class__.__name__).inc()
            logger.error(
                "LLM Manager: Chat call failed",
                extra={"provider": provider_name, "error": str(e), "operation": "chat"},
            )
            raise

    def chat_stream(
        self, *args: Any, provider: str | None = None, **kwargs: Any
    ) -> Generator[str, None, None]:
        """
        Generate a streaming chat completion using specified provider.

        Args:
            *args: Positional arguments passed to provider
            provider: Provider name, defaults to self.default
            **kwargs: Keyword arguments passed to provider

        Yields:
            String chunks of the generated response

        Raises:
            Exception: If streaming fails
        """
        provider_name = provider or self.default
        logger.info(
            "LLM Manager: Starting streaming chat",
            extra={"provider": provider_name, "operation": "chat_stream"},
        )

        model_label = str(kwargs.get("model", "unknown"))
        start_time = time.time()
        LLM_CALLS.labels(model_label, provider_name, "chat_stream").inc()

        provider_gen = self.get(provider).chat_stream(*args, **kwargs)

        def _wrapped() -> Generator[str, None, None]:
            try:
                for chunk in provider_gen:
                    yield chunk
            except Exception as e:  # pragma: no cover - pass through errors
                LLM_ERRORS.labels(
                    model_label, provider_name, e.__class__.__name__
                ).inc()
                logger.error(
                    "LLM Manager: Streaming chat failed",
                    extra={
                        "provider": provider_name,
                        "error": str(e),
                        "operation": "chat_stream",
                    },
                )
                raise
            finally:
                duration = time.time() - start_time
                LLM_LATENCY.labels(model_label, provider_name, "chat_stream").observe(
                    duration
                )

        yield from _wrapped()


# Global instance management
_llm_manager_instance: LLMManager | None = None


def get_llm_manager() -> LLMManager:
    """
    Get or create a global LLM manager instance.

    Uses singleton pattern to ensure consistent configuration
    across the application.

    Returns:
        Global LLM manager instance
    """
    global _llm_manager_instance
    if _llm_manager_instance is None:
        _llm_manager_instance = LLMManager(default=settings.DEFAULT_LLM)
    return _llm_manager_instance
