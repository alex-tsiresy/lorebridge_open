from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import asyncio
from typing import Optional

from app.core.auth_decorators import require_auth
from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limiter import limiter, CHAT_RATE_LIMIT
from app.db.session import get_db
from app.models.user import User as DBUser
from app.schemas.langchain import LangChainChatReq
from app.services.langchain_services.langchain_chat_service import LangChainChatService
from app.services.langchain_services.background_rag_service import background_rag_service
from app.services.rag_services.dynamic_tool_factory import create_dynamic_tools_for_chat

router = APIRouter()


@router.post("/langchain-chat")
@limiter.limit(CHAT_RATE_LIMIT)
async def langchain_chat_endpoint(
    request: Request,
    req: LangChainChatReq,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """LangChain chat endpoint with modular service architecture

    This endpoint is used to chat with the LLM, by the chat node
    in the frontend.

    Args:
        req: LangChainChatReq
        db: Session
        current_user: DBUser

    Returns:
        StreamingResponse
    """
    try:
        # current_user is already available from dependency injection

        # Create chat service
        chat_service = LangChainChatService(db)

        # Create streaming response
        async def event_stream():
            async for chunk in chat_service.create_chat_stream(
                session_id=req.session_id,
                user_id=str(current_user.id),  # Use database UUID as string
                messages=req.messages,
                model=req.model,
                temperature=req.temperature,
            ):
                yield chunk

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    except ValueError as e:
        # Handle session ID validation errors
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from None
    except Exception as e:
        # Handle other unexpected errors
        logger.error(f"Unexpected error in langchain chat endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        ) from e


@router.post("/langchain-chat-background")
@limiter.limit(CHAT_RATE_LIMIT)
async def langchain_chat_background_endpoint(
    request: Request,
    req: LangChainChatReq,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    LangChain chat endpoint optimized for heavy PDF operations using background tasks.
    
    This endpoint immediately returns a streaming response while processing heavy
    RAG operations in the background, providing better user experience and 
    preventing request timeouts.
    """
    try:
        # Check if this request involves PDF tools
        pdf_tools = create_dynamic_tools_for_chat(req.session_id, db, str(current_user.id))
        has_pdf_tools = any("pdf" in tool.name.lower() for tool in pdf_tools)
        
        # If no PDF tools, use regular endpoint
        if not has_pdf_tools:
            logger.info("No PDF tools detected, using regular streaming")
            chat_service = LangChainChatService(db)
            
            async def regular_stream():
                async for chunk in chat_service.create_chat_stream(
                    session_id=req.session_id,
                    user_id=str(current_user.id),
                    messages=req.messages,
                    model=req.model,
                    temperature=req.temperature,
                ):
                    yield chunk

            return StreamingResponse(regular_stream(), media_type="text/event-stream")
        
        # For PDF-heavy operations, use background processing
        logger.info(f"PDF tools detected ({len(pdf_tools)}), using background processing")
        
        # Create background queue
        queue_id = await background_rag_service.queue_manager.create_queue(req.session_id)
        
        # Check if the user's message likely contains PDF questions
        user_message = next(
            (msg["content"] for msg in req.messages if msg["role"] == "user"), 
            ""
        )
        
        # For each PDF tool, check if it might be relevant and queue background processing
        for pdf_tool in pdf_tools:
            asset_id = pdf_tool.name.split("_")[-1]  # Extract asset ID from tool name
            
            # Add background task for each PDF
            background_tasks.add_task(
                background_rag_service.process_pdf_question_background,
                queue_id,
                db,
                str(current_user.id),
                asset_id,
                user_message,
                f"PDF {asset_id[:8]}"
            )
        
        # Return streaming response that polls for background results
        async def background_stream():
            async for chunk in background_rag_service.create_background_stream(queue_id):
                yield chunk

        return StreamingResponse(background_stream(), media_type="text/event-stream")
        
    except Exception as e:
        logger.error(f"Background chat endpoint error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Background processing error occurred",
        ) from e
