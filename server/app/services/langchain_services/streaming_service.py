import dataclasses
import json
from typing import Any

from langchain_core.messages import ToolMessage

from app.core.logger import logger


class StreamingService:
    """Service for handling streaming responses and token processing"""

    def __init__(self):
        pass

    def messages_to_langgraph_format(
        self, messages: list[dict[str, Any]]
    ) -> list[tuple]:
        """Convert chat history to LangGraph format"""
        formatted = []
        for msg in messages:
            # 'context' role is handled before this, so we don't need to check for it.
            if msg["role"] in ("user", "assistant", "system"):
                formatted.append((msg["role"], msg["content"]))
        return formatted

    def serialize_message(self, msg: Any) -> dict[str, Any]:
        """Serialize LangChain message objects"""
        if hasattr(msg, "to_dict"):
            return msg.to_dict()
        elif hasattr(msg, "dict"):
            return msg.dict()
        elif isinstance(msg, dict):
            return msg
        else:
            return str(msg)

    def serialize_update(self, update: Any) -> Any:
        """Recursively serialize any LangChain message objects in the update"""
        if isinstance(update, dict):
            return {k: self.serialize_update(v) for k, v in update.items()}
        elif isinstance(update, list):
            return [self.serialize_update(i) for i in update]
        # Handle AIMessage, etc.
        return self.serialize_message(update)

    def serialize_token(self, token: Any) -> dict[str, Any]:
        """Serialize a streaming token"""
        if hasattr(token, "to_dict"):
            return token.to_dict()
        elif hasattr(token, "content"):
            # Fallback for message chunks: extract content and id if available
            result = {"content": token.content}
            if hasattr(token, "id"):
                result["id"] = token.id
            return result
        elif dataclasses.is_dataclass(token):
            return dataclasses.asdict(token)
        elif isinstance(token, dict):
            return token
        else:
            return str(token)

    def process_tool_message(self, message_chunk: ToolMessage) -> dict[str, Any]:
        """Process ToolMessage and extract tool outputs"""
        # ToolMessage content is typically a string that needs to be parsed
        if isinstance(message_chunk.content, str):
            # First try to parse as JSON
            try:
                data = json.loads(message_chunk.content)
            except json.JSONDecodeError:
                # If it's not JSON, treat it as plain text (e.g., PDF tool responses)
                logger.info(
                    f"Tool returned plain text response: {message_chunk.content[:100]}..."
                )
                return {
                    "type": "tool_call",
                    "raw_content": str(message_chunk.content),
                    "tool_type": "text_response",
                }
        else:
            data = message_chunk.content

        # Check if this is a web search result with the expected structure
        if isinstance(data, dict) and "searchParameters" in data and "organic" in data:
            return data

        # Check if this is a PDF/RAG tool result
        elif isinstance(data, dict) and (
            "method" in data or "chunks_used" in data or "success" in data
        ):
            logger.info(
                f"RAG tool output: method={data.get('method', 'unknown')}, chunks_used={data.get('chunks_used', 0)}, context_tokens={data.get('context_tokens', 0)}"
            )

            # Log retrieved chunks details
            relevant_chunks = data.get("relevant_chunks", [])
            if relevant_chunks:
                logger.info(f"Retrieved chunks count: {len(relevant_chunks)}")
                for i, chunk in enumerate(relevant_chunks[:3]):  # Log first 3 chunks
                    chunk_content = (
                        chunk.get("text", "")[:200] + "..."
                        if len(chunk.get("text", "")) > 200
                        else chunk.get("text", "")
                    )
                    similarity = chunk.get("similarity_score", 0)
                    logger.info(f"Chunk {i + 1} (similarity: {similarity:.3f}): {chunk_content}")
                if len(relevant_chunks) > 3:
                    logger.info(f"... and {len(relevant_chunks) - 3} more chunks")

            # Format RAG results for frontend display
            rag_output = {
                "type": "rag_result",
                "method": data.get("method", "unknown"),
                "chunks_used": data.get("chunks_used", 0),
                "context_tokens": data.get("context_tokens", 0),
                "relevant_chunks": data.get("relevant_chunks", []),
                "answer": data.get("answer", ""),
                "pdf_title": data.get("pdf_title"),
                "asset_id": data.get("asset_id"),
                "processing_time": data.get("processing_time"),
                "success": data.get("success", True),
                "error": data.get("error")
            }

            # Log the exact data format being sent to frontend
            logger.info(
                f"RAG output data format being sent to frontend: {json.dumps(rag_output, indent=2, ensure_ascii=False)}"
            )

            return rag_output
        else:
            # For other structured tool responses
            if isinstance(data, dict):
                return {"type": "tool_call", "tool_data": data}

        # If we get here, return None (no tool output to process)
        return None

    def process_message_chunk(self, message_chunk: Any) -> tuple[str, bool]:
        """Process a message chunk and return content and whether it's a tool output"""
        if isinstance(message_chunk.content, str) and message_chunk.content:
            is_tool_output = False
            try:
                data = json.loads(message_chunk.content)
                # This is a heuristic based on the frontend code's handling of web search results.
                # It identifies the tool output by the presence of specific keys.
                if (
                    isinstance(data, dict)
                    and "searchParameters" in data
                    and "organic" in data
                ) or (
                    isinstance(data, dict)
                    and ("method" in data or "chunks_used" in data or "success" in data)
                ):
                    is_tool_output = True
            except json.JSONDecodeError:
                # Content is not a JSON string, so it's regular text.
                # Check if this looks like a tool response (e.g., contains specific patterns)
                content = message_chunk.content.lower()
                if any(
                    keyword in content
                    for keyword in ["pdf", "document", "excerpt", "context", "answer"]
                ):
                    # This might be a tool response, but we'll treat it as regular text for now
                    # since it's not structured JSON
                    pass

            if not is_tool_output:
                return message_chunk.content, False

        return "", True

    def create_streaming_response(self, token: Any) -> str:
        """Create a streaming response for a token"""
        try:
            if isinstance(token, tuple):
                stream_token_data = {
                    "message": self.serialize_token(token[0]),
                    "metadata": (
                        self.serialize_update(token[1]) if len(token) > 1 else None
                    ),
                }
            else:
                stream_token_data = self.serialize_token(token)
        except Exception as stream_exc:
            logger.warning(
                f"Failed to serialize LangGraph token for streaming: {stream_exc}"
            )
            stream_token_data = str(token)

        return (
            f"data: {json.dumps({'type': 'token', 'content': stream_token_data})}\n\n"
        )

    def create_error_response(self, error: str) -> str:
        """Create an error response"""
        return f"data: {json.dumps({'type': 'error', 'error': error})}\n\n"

    def create_tool_output_response(self, tool_output: dict[str, Any]) -> str:
        """Create a tool output response for streaming"""
        return (
            f"data: {json.dumps({'type': 'tool_output', 'content': tool_output})}\n\n"
        )

    def create_done_response(self) -> str:
        """Create a done response"""
        return "data: [DONE]\n\n"
