import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession


class ChatPersistenceService:
    """Service for handling chat message persistence and session management"""

    def __init__(self, db: Session):
        self.db = db

    def ensure_chat_session(self, session_uuid: uuid.UUID, model: str) -> bool:
        """Ensure chat session exists and is updated with current model"""
        try:
            chat_session = (
                self.db.query(ChatSession)
                .filter(ChatSession.id == session_uuid)
                .first()
            )
            if not chat_session:
                chat_session = ChatSession(id=session_uuid, model_used=model)
                self.db.add(chat_session)
            else:
                chat_session.model_used = model
            self.db.commit()
            return True
        except Exception as e:
            logger.error(
                f"Failed to persist chat session for UUID {session_uuid}: {e}",
                exc_info=True,
            )
            self.db.rollback()
            return False

    def persist_user_message(self, session_uuid: uuid.UUID, content: str) -> bool:
        """Persist a user message to the database"""
        try:
            user_message = ChatMessage(
                chat_session_id=session_uuid, role="user", content=content
            )
            self.db.add(user_message)
            self.db.commit()
            return True
        except Exception as e:
            logger.error(
                f"Failed to persist user message for session UUID {session_uuid}: {e}",
                exc_info=True,
            )
            self.db.rollback()
            return False

    def persist_assistant_message(
        self,
        session_uuid: uuid.UUID,
        content: str,
        tool_outputs: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Persist an assistant message with optional tool outputs"""
        try:
            assistant_message = ChatMessage(
                chat_session_id=session_uuid,
                role="assistant",
                content=content,
                tool_output=tool_outputs if tool_outputs else None,
            )
            self.db.add(assistant_message)
            self.db.commit()
            logger.info(
                f"Assistant message saved with {len(tool_outputs) if tool_outputs else 0} tool outputs"
            )
            return True
        except Exception as e:
            logger.error(
                f"Failed to persist assistant message for session UUID {session_uuid}: {e}",
                exc_info=True,
            )
            self.db.rollback()
            return False

    def get_user_message_content(self, messages: list[dict[str, Any]]) -> str | None:
        """Extract the content of the last user message"""
        if messages and messages[-1].get("role") == "user":
            return messages[-1].get("content")
        return None
