import asyncio
import uuid
from collections.abc import Generator
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.services.langchain_services.chat_persistence_service import (
    ChatPersistenceService,
)
from app.services.langchain_services.context_formatter_service import (
    ContextFormatterService,
)
from app.services.langchain_services.langchain_agent_service import (
    LangChainAgentService,
)
from app.services.langchain_services.streaming_service import StreamingService
from app.services.metrics import (
    LANGCHAIN_ERRORS,
    LANGCHAIN_STREAM_SECONDS,
    LANGGRAPH_LLM_CALLS,
    LANGGRAPH_TOKENS,
)

from app.services.async_db_service import async_db_service



class LangChainChatService:
    """Main service for orchestrating LangChain chat functionality"""

    def __init__(self, db: Session):
        self.db = db
        self.agent_service = LangChainAgentService()
        self.context_formatter = ContextFormatterService()
        self.persistence_service = ChatPersistenceService(db)
        self.streaming_service = StreamingService()

    def validate_session_id(self, session_id: str) -> uuid.UUID:
        """Validate and convert session_id to UUID"""
        try:
            return uuid.UUID(session_id)
        except ValueError:
            logger.error(
                f"Invalid session_id format: Cannot convert to UUID: {session_id}"
            )
            raise ValueError(f"Invalid session_id format: {session_id}") from None

    async def create_chat_stream(
        self,
        session_id: str,
        user_id: str,
        messages: list[dict[str, Any]],
        model: str,
        temperature: float = None,
    ) -> Generator[str, None, None]:
        """Create a streaming chat response"""
        # Validate session ID
        session_uuid = self.validate_session_id(session_id)

        # Start async chat session creation (non-blocking)
        asyncio.create_task(
            async_db_service.ensure_chat_session_async(session_uuid, model)
        )

        # Create agent with tools
        agent, tools = self.agent_service.create_agent(
            session_id, user_id, model, temperature, self.db
        )

        # Process messages and context
        processed_messages = self.context_formatter.process_messages_and_context(
            messages,
            dynamic_tools_count=len(
                [
                    tool
                    for tool in tools
                    if "pdf" in tool.name.lower() or "rag" in tool.name.lower()
                ]
            ),
        )

        # Start async user message persistence (non-blocking)
        user_message_content = self.persistence_service.get_user_message_content(
            messages
        )
        if user_message_content:
            asyncio.create_task(
                async_db_service.persist_chat_message_async(
                    session_uuid, "user", user_message_content
                )
            )

        # Convert messages to LangGraph format
        langgraph_messages = self.streaming_service.messages_to_langgraph_format(
            processed_messages
        )

        # Stream the response
        full_response_content = ""
        tool_outputs = []

        try:
            import time as _t
            _start = _t.time()
            # Count the LLM call at start (by model)
            try:
                LANGGRAPH_LLM_CALLS.labels(model).inc()
            except Exception:
                pass

            async for token in agent.astream(
                {"messages": langgraph_messages}, stream_mode="messages"
            ):
                # Process the token
                message_chunk = self._extract_message_chunk(token)

                if message_chunk:
                    # Handle ToolMessage specifically for web search results
                    if isinstance(message_chunk, ToolMessage):
                        tool_output = self.streaming_service.process_tool_message(
                            message_chunk
                        )
                        if tool_output:
                            tool_outputs.append(tool_output)
                            # Send tool output to frontend as a special event
                            yield self.streaming_service.create_tool_output_response(
                                tool_output
                            )
                        # Don't stream ToolMessage content to frontend - it's handled as tool output
                        continue

                    # Handle regular message content
                    else:
                        content, is_tool_output = (
                            self.streaming_service.process_message_chunk(message_chunk)
                        )
                        if not is_tool_output:
                            full_response_content += content

                # Stream the token (but skip ToolMessages)
                if not isinstance(message_chunk, ToolMessage):
                    yield self.streaming_service.create_streaming_response(token)
                await asyncio.sleep(0)

        except Exception as e:
            logger.error(f"LangGraph streaming error: {e}", exc_info=True)
            LANGCHAIN_ERRORS.labels(e.__class__.__name__).inc()
            yield self.streaming_service.create_error_response(str(e))
        finally:
            # Log final tool outputs that will be stored in database
            if tool_outputs:
                logger.info(
                    f"Final tool_outputs array to be stored in database: {tool_outputs}"
                )

            # Start async assistant message persistence (non-blocking)
            if full_response_content:
                asyncio.create_task(
                    async_db_service.persist_chat_message_async(
                        session_uuid,
                        "assistant",
                        full_response_content,
                        tool_outputs if tool_outputs else None,
                    )
                )

            yield self.streaming_service.create_done_response()
            try:
                LANGCHAIN_STREAM_SECONDS.labels("success").observe(_t.time() - _start)
            except Exception:
                pass

    def _extract_message_chunk(self, token: Any) -> Any:
        """Extract message chunk from token"""
        if isinstance(token, AIMessage | ToolMessage):
            return token
        elif (
            isinstance(token, tuple)
            and len(token) > 0
            and isinstance(token[0], AIMessage | ToolMessage)
        ):
            return token[0]
        return None
