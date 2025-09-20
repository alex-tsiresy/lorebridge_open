from collections.abc import Generator
from typing import Any

from app.core.logger import logger
from app.services.ai.llm_manager import get_llm_manager


class StreamProcessingService:
    """Service for processing LLM streaming responses."""

    def __init__(self):
        self.llm_manager = get_llm_manager()

    def stream_llm_response(
        self, llm_input: list, model: str, session_id: str
    ) -> Generator[str, None, None]:
        """
        Stream LLM response and handle chunk processing.

        Args:
            llm_input: Prepared LLM input messages
            model: Model name to use
            session_id: Session ID for logging

        Yields:
            Processed content chunks
        """
        logger.info(
            f"[StreamProcessing] Starting LLM streaming for session: {session_id}"
        )
        logger.info(f"[StreamProcessing] Using model: {model}")
        logger.debug(
            f"[StreamProcessing] LLM input structure: {len(llm_input)} messages"
        )

        chunk_count = 0
        total_chars = 0

        try:
            for chunk in self.llm_manager.chat_stream(
                input=llm_input, model=model, temperature=0.3, max_output_tokens=10000
            ):
                # Process chunk and extract content
                chunk_content = self._extract_chunk_content(chunk)

                if chunk_content and chunk_content.strip():
                    chunk_count += 1
                    total_chars += len(chunk_content)
                    yield chunk_content

        except Exception as e:
            logger.error(
                f"[StreamProcessing] Error during streaming: {e!s}", exc_info=True
            )
            # Delegate error handling to specialized method
            error_message = self._handle_streaming_error(e, model)
            yield error_message

        logger.info(
            f"[StreamProcessing] Streaming completed. Total chunks: {chunk_count}, total characters: {total_chars}"
        )

    def _extract_chunk_content(self, chunk: Any) -> str | None:
        """
        Extract content from different types of LLM response chunks.

        Args:
            chunk: Raw chunk from LLM stream

        Returns:
            Extracted content string or None
        """
        # Handle Responses API delta events (streaming chunks)
        if hasattr(chunk, "type") and chunk.type == "response.output_text.delta":
            if hasattr(chunk, "delta") and chunk.delta:
                return str(chunk.delta)

        elif (
            isinstance(chunk, dict)
            and chunk.get("type") == "response.output_text.delta"
        ):
            delta = chunk.get("delta", "")
            if delta:
                return str(delta)

        # Return None for non-delta events to prevent duplicates
        return None

    def _handle_streaming_error(self, error: Exception, model: str) -> str:
        """
        Handle different types of streaming errors and return appropriate error messages.

        Args:
            error: The exception that occurred
            model: Model name being used

        Returns:
            User-friendly error message
        """
        error_msg = str(error)

        # Model-related errors
        if "model" in error_msg.lower() and "not found" in error_msg.lower():
            return f"\n\n_Error: Model '{model}' is not supported. Please try a different model._\n"

        # Authentication errors
        if "api key" in error_msg.lower():
            return "\n\n_Error: Invalid API key. Please check your OpenAI configuration._\n"

        # Rate limiting errors
        if "rate limit" in error_msg.lower():
            return "\n\n_Error: Rate limit exceeded. Please try again later._\n"

        # Timeout errors
        if "timeout" in error_msg.lower():
            return "\n\n_Error: Request timed out. Please try again._\n"

        # Network errors
        if "network" in error_msg.lower() or "connection" in error_msg.lower():
            return "\n\n_Error: Network connection issue. Please check your internet connection and try again._\n"

        # Generic error fallback
        return f"\n\n_Error generating markdown document: {error_msg}_\n"
