from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.config import settings
from app.core.rate_limiter import limiter, CREATE_RATE_LIMIT, READ_RATE_LIMIT, CHAT_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession
from app.schemas.common import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post(
    "/sessions", response_model=ChatSessionResponse, summary="Create a new chat session"
)
@limiter.limit(CREATE_RATE_LIMIT)
def create_chat_session(
    request: Request,
    session: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a new chat session (node). Requires Clerk authentication.
    """
    
    db_session = ChatSession(**session.dict())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get(
    "/{chat_session_id}/messages",
    response_model=list[ChatMessageResponse],
    summary="Get chat history",
)
@limiter.limit(READ_RATE_LIMIT)
def get_chat_history(
    request: Request,
    chat_session_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get the full chat history for a chat session. Requires Clerk authentication.
    Enhanced security: Verifies chat session belongs to user's graph.
    """
    # SECURITY: Verify chat session belongs to user's graph through node ownership
    from app.db.models.node import Node
    from app.db.models.graph import Graph
    
    # Check if chat session exists and belongs to user's graph
    chat_exists = (
        db.query(ChatSession)
        .join(Node, Node.content_id == ChatSession.id)
        .join(Graph, Graph.id == Node.graph_id)
        .filter(
            ChatSession.id == chat_session_id,
            Graph.user_id == current_user.id
        )
        .first()
    )
    
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_session_id == chat_session_id)
        .order_by(ChatMessage.timestamp)
        .all()
    )


@router.post(
    "/{chat_session_id}/messages",
    response_model=ChatMessageResponse,
    summary="Send a message to a chat session",
)
@limiter.limit(CHAT_RATE_LIMIT)
def send_message(
    request: Request,
    chat_session_id: str,
    message: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Send a message to a chat session. Requires Clerk authentication.
    Enhanced security: Verifies chat session belongs to user's graph.
    """
    # SECURITY: Verify chat session belongs to user's graph through node ownership
    from app.db.models.node import Node
    from app.db.models.graph import Graph
    
    # Check if chat session exists and belongs to user's graph
    chat_exists = (
        db.query(ChatSession)
        .join(Node, Node.content_id == ChatSession.id)
        .join(Graph, Graph.id == Node.graph_id)
        .filter(
            ChatSession.id == chat_session_id,
            Graph.user_id == current_user.id
        )
        .first()
    )
    
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    db_message = ChatMessage(**message.dict(), chat_session_id=str(chat_session_id))
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message
