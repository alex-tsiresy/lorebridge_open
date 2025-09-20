import uuid

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession


class SessionValidationService:
    """Service for validating chat sessions and retrieving session data."""

    def __init__(self, db: Session):
        self.db = db

    def validate_and_get_session(
        self, session_id: str
    ) -> tuple[ChatSession | None, str | None]:
        """
        Validate session ID and retrieve session.

        Returns:
            Tuple of (session, error_message). If session is None, error_message explains why.
        """
        # Validate UUID format
        try:
            session_uuid = uuid.UUID(session_id)
        except Exception:
            logger.error(f"[SessionValidation] Invalid session id format: {session_id}")
            return None, f"Invalid session id: {session_id}"

        # Check if session exists
        session = (
            self.db.query(ChatSession).filter(ChatSession.id == session_uuid).first()
        )
        if not session:
            logger.error(f"[SessionValidation] Session not found: {session_id}")
            return None, f"Session not found: {session_id}"

        logger.info(f"[SessionValidation] Session validated successfully: {session_id}")
        return session, None

    def get_session_messages(self, session_id: str) -> tuple[list, str | None]:
        """
        Retrieve messages for a session.

        Returns:
            Tuple of (messages, error_message). If messages is empty, error_message explains why.
        """
        try:
            session_uuid = uuid.UUID(session_id)
        except Exception:
            return [], f"Invalid session id: {session_id}"

        messages = (
            self.db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == session_uuid)
            .order_by(ChatMessage.timestamp)
            .all()
        )

        if not messages:
            logger.warning(
                f"[SessionValidation] No messages found for session: {session_id}"
            )
            return [], "No messages found for this session."

        logger.info(
            f"[SessionValidation] Found {len(messages)} messages for session: {session_id}"
        )
        return messages, None
