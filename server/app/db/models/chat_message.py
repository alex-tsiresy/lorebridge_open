import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.db.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    # For context messages: identifies the chat session that was the ORIGINAL source of this context.
    # Nullable because regular user/assistant messages, or context from non-chat sources, won't have it.
    source_chat_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=True,
    )
    role = Column(String)  # 'user', 'assistant', 'system', 'context'
    content = Column(Text)
    tool_output = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
