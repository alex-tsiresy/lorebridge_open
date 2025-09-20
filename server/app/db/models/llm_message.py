import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class RoleEnum(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class LLMMessage(Base):
    __tablename__ = "llm_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id"), index=True, nullable=False
    )
    user_id = Column(String, index=True, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    content = Column(String, nullable=False)
    model = Column(String, nullable=False)
    is_request = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
