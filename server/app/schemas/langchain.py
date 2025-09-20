from typing import Any

from pydantic import BaseModel, Field


class LangChainChatReq(BaseModel):
    session_id: str = Field(...)
    user_id: str = Field(...)
    messages: list[dict[str, Any]] = Field(...)
    model: str = Field(default="gpt-4o-mini")
    temperature: float | None = Field(default=None)
    previous_response_id: str = Field(default=None)


class ToolOutput(BaseModel):
    type: str
    method: str | None = None
    chunks_used: int | None = None
    context_tokens: int | None = None
    relevant_chunks: list[dict[str, Any]] | None = None
    answer: str | None = None
    tool_data: dict[str, Any] | None = None
    raw_content: str | None = None


class StreamingToken(BaseModel):
    type: str = "token"
    content: dict[str, Any]


class StreamingError(BaseModel):
    type: str = "error"
    error: str
