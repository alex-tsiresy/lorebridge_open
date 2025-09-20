from typing import Any

from app.core.logger import logger
from app.db.models.chat_message import ChatMessage



class LLMInputPreparationService:
    """Service for preparing LLM input from chat messages."""

    def prepare_chat_history(self, messages: list[ChatMessage]) -> list[dict[str, str]]:
        """
        Convert chat messages to LLM-compatible format.

        Args:
            messages: List of ChatMessage objects

        Returns:
            List of formatted messages for LLM input
        """
        chat_history = []
        for msg in messages:
            role = msg.role if msg.role else "user"
            content = msg.content or ""
            chat_history.append({"role": role, "content": content})

        logger.debug(
            f"[LLMInputPreparation] Prepared {len(chat_history)} messages for LLM"
        )
        return chat_history

    def build_llm_input_messages(
        self, chat_history: list[dict[str, str]], system_prompt: str
    ) -> list[dict[str, Any]]:
        """
        Build the complete LLM input in OpenAI Responses API format.

        Args:
            chat_history: Prepared chat history

        Returns:
            Formatted LLM input messages
        """
        # Format chat transcript for the LLM
        chat_transcript = "\n".join(
            [f"{msg['role']}: {msg['content']}" for msg in chat_history]
        )

        llm_input = [
            {
                "role": "developer",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": chat_transcript}],
            },
        ]

        logger.debug(
            f"[LLMInputPreparation] Built LLM input with {len(llm_input)} messages"
        )
        logger.debug(
            f"[LLMInputPreparation] Chat transcript length: {len(chat_transcript)} characters"
        )

        return llm_input
