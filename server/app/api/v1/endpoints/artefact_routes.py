import asyncio
import json
import time
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.logger import logger
from app.core.rate_limiter import limiter, PROCESSING_RATE_LIMIT, READ_RATE_LIMIT
from app.db.database import get_db
from app.db.models.artefact import Artefact
from app.models.user import User as DBUser
from app.schemas.common import ArtefactResponse, ArtefactType, ArtefactUpdate
from app.services.dependencies import get_markdown_export_service, get_mermaid_export_service
from app.services.metrics import (
    ARTEFACTS_CREATED,
    ARTEFACT_ERRORS,
    ARTEFACT_PROCESSING_SECONDS,
    EXPORT_PROCESS_SECONDS,
)
from app.services.export.table_export_service import TableExportService
from app.services.export.artefact_description_service import ArtefactDescriptionService
from app.services.export import ProcessingOptionsService

router = APIRouter(prefix="/artefacts", tags=["Artefact"])


@router.get(
    "/{artefact_id}",
    response_model=ArtefactResponse,
    summary="Get artefact details/data",
)
@limiter.limit(READ_RATE_LIMIT)
def get_artefact(
    request: Request,
    artefact_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get artefact details and data.
    Usecase: UI loads artefact node for expanded view.
    """
    # Query artefact with user isolation
    artefact = db.query(Artefact).filter(
        Artefact.id == artefact_id,
        Artefact.user_id == current_user.id
    ).first()
    
    if not artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")
    return artefact


@router.put(
    "/{artefact_id}", response_model=ArtefactResponse, summary="Update artefact data"
)
def update_artefact(
    artefact_id: str,
    artefact: ArtefactUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update artefact data (e.g., user-edited table).
    Usecase: User edits a table or document artefact.
    """
    # Query artefact with user isolation
    db_artefact = db.query(Artefact).filter(
        Artefact.id == artefact_id,
        Artefact.user_id == current_user.id
    ).first()
    
    if not db_artefact:
        raise HTTPException(status_code=404, detail="Artefact not found")
    for k, v in artefact.dict(exclude_unset=True).items():
        setattr(db_artefact, k, v)
    db.commit()
    db.refresh(db_artefact)
    return db_artefact


@router.post(
    "/document",
    response_model=ArtefactResponse,
    summary="Create a document artefact from a chat session and stream the markdown output",
)
async def create_document_artefact(
    chat_session_id: str = Query(..., description="Chat session ID"),
    model: str = Query(None, description="Model to use for generation"),
    artefact_id: str = Query(
        None,
        description="Optional existing artefact ID to update instead of creating new one",
    ),
    selected_option: dict | None = Body(None, description="User-selected processing option to guide markdown generation"),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a document artefact by generating a markdown document from a chat session (via LLM),
    stream the markdown output as JSON events, and save the result as an artefact after streaming is complete.
    """
    logger.info(
        "%s %s",
        "[ArtefactRoutes] EVENT: Document artefact creation request received",
        json.dumps(
            {
                "chat_session_id": chat_session_id,
                "model": model or "default",
                "artefact_id": artefact_id or "none",
                "user_id": current_user.clerk_user_id,
                "timestamp": time.time(),
            }
        ),
    )

    # Validate chat session ID format
    try:
        uuid.UUID(chat_session_id)
        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Chat session ID validation passed",
            json.dumps({"chat_session_id": chat_session_id, "timestamp": time.time()}),
        )
    except ValueError:
        logger.error(
            "%s %s",
            "[ArtefactRoutes] EVENT: Invalid chat session ID format",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "error": "invalid_uuid_format",
                    "timestamp": time.time(),
                }
            ),
        )
        raise HTTPException(
            status_code=400, detail=f"Invalid chat session ID format: {chat_session_id}"
        ) from None

    md_service = get_markdown_export_service(db)

    async def event_stream():
        # Initialize artefact_id variable for error handling
        current_artefact_id = artefact_id

        # Validate that we have a valid database session
        if not db:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: No database session available",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "error": "no_database_session",
                        "timestamp": time.time(),
                    }
                ),
            )
            yield f"data: {json.dumps({'type': 'error', 'error': 'Database connection not available'})}\n\n"
            return

        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Starting markdown streaming",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "model": model or "default",
                    "timestamp": time.time(),
                }
            ),
        )
        chunk_count = 0
        total_chars = 0
        markdown_content = ""
        start_time = time.time()

        try:
            for chunk in md_service.stream_session_markdown_llm(
                chat_session_id, model=model, selected_option=selected_option
            ):
                markdown_content += chunk
                chunk_count += 1
                total_chars += len(chunk)

                # Stream chunk as JSON event (same format as langchain_llm.py)
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            elapsed_time = time.time() - start_time
            EXPORT_PROCESS_SECONDS.labels("markdown", "success").observe(elapsed_time)
            logger.info(
                "%s %s",
                "[ArtefactRoutes] EVENT: Markdown streaming completed",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "total_chunks": chunk_count,
                        "total_chars": total_chars,
                        "elapsed_time_seconds": round(elapsed_time, 2),
                        "timestamp": time.time(),
                    }
                ),
            )

            # Save the artefact after streaming is complete
            if markdown_content.strip():
                try:
                    if current_artefact_id:
                        # Update existing artefact
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: Updating existing document artefact",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "artefact_id": current_artefact_id,
                                    "content_length": len(markdown_content),
                                    "timestamp": time.time(),
                                }
                            ),
                        )

                        existing_artefact = (
                            db.query(Artefact)
                            .filter(Artefact.id == current_artefact_id)
                            .first()
                        )
                        if existing_artefact:
                            existing_artefact.current_data = {
                                "markdown": markdown_content
                            }
                            existing_artefact.type = ArtefactType.document
                            if selected_option is not None:
                                existing_artefact.selected_processing_option = selected_option
                                if not existing_artefact.processing_output_type:
                                    existing_artefact.processing_output_type = "markdown"
                            db.commit()
                            ARTEFACTS_CREATED.labels("document").inc()
                            logger.info(
                                "%s %s",
                                "[ArtefactRoutes] EVENT: Existing document artefact updated successfully",
                                json.dumps(
                                    {
                                        "chat_session_id": chat_session_id,
                                        "artefact_id": current_artefact_id,
                                        "timestamp": time.time(),
                                    }
                                ),
                            )
                        else:
                            logger.error(
                                "%s %s",
                                "[ArtefactRoutes] EVENT: Existing artefact not found",
                                json.dumps(
                                    {
                                        "chat_session_id": chat_session_id,
                                        "artefact_id": current_artefact_id,
                                        "timestamp": time.time(),
                                    }
                                ),
                            )
                            # Fall back to creating new artefact
                            current_artefact_id = str(uuid.uuid4())
                            # current_user is already available from dependency injection
                            artefact = Artefact(
                                id=current_artefact_id,
                                user_id=current_user.id,
                                type=ArtefactType.document,
                                current_data={"markdown": markdown_content},
                            )
                            db.add(artefact)
                            db.commit()
                            ARTEFACTS_CREATED.labels("document").inc()
                    else:
                        # Create new artefact
                        new_artefact_id = uuid.uuid4()
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: Creating new document artefact",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "artefact_id": str(new_artefact_id),
                                    "content_length": len(markdown_content),
                                    "timestamp": time.time(),
                                }
                            ),
                        )

                        # current_user is already available from dependency injection
                        artefact = Artefact(
                            id=new_artefact_id,
                            user_id=current_user.id,
                            type=ArtefactType.document,
                            current_data={"markdown": markdown_content},
                        )
                        if selected_option is not None:
                            artefact.selected_processing_option = selected_option
                            artefact.processing_output_type = "markdown"
                        db.add(artefact)
                        db.commit()
                        ARTEFACTS_CREATED.labels("document").inc()
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: New document artefact created successfully",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "artefact_id": str(new_artefact_id),
                                    "timestamp": time.time(),
                                }
                            ),
                        )
                except Exception as save_error:
                    logger.error(
                        "%s %s",
                        "[ArtefactRoutes] EVENT: Error saving document artefact",
                        json.dumps(
                            {
                                "chat_session_id": chat_session_id,
                                "artefact_id": (
                                    current_artefact_id if current_artefact_id else "new"
                                ),
                                "error": str(save_error),
                                "timestamp": time.time(),
                            }
                        ),
                        exc_info=True,
                    )
                    db.rollback()
                    ARTEFACT_ERRORS.labels("document", "save_error").inc()
            else:
                logger.warning(
                    "%s %s",
                    "[ArtefactRoutes] EVENT: No content to save",
                    json.dumps(
                        {
                            "chat_session_id": chat_session_id,
                            "content_length": len(markdown_content),
                            "timestamp": time.time(),
                        }
                    ),
                )

        except Exception as e:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: Error during markdown streaming",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "error": str(e),
                        "chunk_count": chunk_count,
                        "total_chars": total_chars,
                        "timestamp": time.time(),
                    }
                ),
                exc_info=True,
            )
            EXPORT_PROCESS_SECONDS.labels("markdown", "error").observe(time.time() - start_time)
            ARTEFACT_ERRORS.labels("document", e.__class__.__name__).inc()
            yield f"data: {json.dumps({'type': 'error', 'error': f'Error during streaming: {e!s}'})}\n\n"
        finally:
            # Send completion signal
            yield "data: [DONE]\n\n"

    logger.info(
        "%s %s",
        "[ArtefactRoutes] EVENT: Returning streaming response",
        json.dumps(
            {
                "chat_session_id": chat_session_id,
                "media_type": "text/event-stream",
                "timestamp": time.time(),
            }
        ),
    )
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/options",
    summary="Generate processing options (table/markdown/mermaid) from a chat session and stream JSON options",
)
@limiter.limit(PROCESSING_RATE_LIMIT)
async def generate_processing_options(
    request: Request,
    chat_session_id: str = Query(..., description="Chat session ID"),
    output_type: str = Query(..., description="Desired output type: table | markdown | mermaid"),
    model: str = Query(None, description="Model to use for generation (optional)"),
    artefact_id: str | None = Query(None, description="Optional artefact ID to persist options into"),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Stream a structured JSON list of suggested processing options for the given chat session context.
    The frontend can render these as choices for the user to decide how to proceed (e.g., table, notes, mermaid).
    """
    # Validate chat session ID format
    try:
        uuid.UUID(chat_session_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid chat session ID format: {chat_session_id}"
        ) from None

    # Initialize service (allow overriding model)
    svc = ProcessingOptionsService(db, model_name=model) if model else ProcessingOptionsService(db)

    async def event_stream():
        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Starting processing options streaming",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "output_type": output_type,
                    "model": model or "default",
                    "artefact_id": artefact_id or "none",
                    "timestamp": time.time(),
                }
            ),
        )

        chunk_count = 0
        total_chars = 0
        start_time = time.time()
        aggregated = ""

        try:
            for chunk in svc.stream_session_processing_options_json(chat_session_id, output_type):
                chunk_count += 1
                total_chars += len(chunk)
                aggregated += chunk
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            elapsed_time = time.time() - start_time
            # Start async persistence of options to artefact (non-blocking)
            if artefact_id:
                try:
                    options_obj = json.loads(aggregated)
                    from app.services.async_db_service import async_db_service
                    asyncio.create_task(
                        async_db_service.update_artefact_async(
                            artefact_id,
                            {
                                "processing_output_type": output_type,
                                "processing_options": options_obj,
                                "processing_primary_option_id": options_obj.get("primary_option_id")
                            }
                        )
                    )
                except Exception as persist_err:
                    logger.error("[ArtefactRoutes] Failed to start async persistence of processing options: %s", persist_err, exc_info=True)
            logger.info(
                "%s %s",
                "[ArtefactRoutes] EVENT: Processing options streaming completed",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "output_type": output_type,
                        "total_chunks": chunk_count,
                        "total_chars": total_chars,
                        "elapsed_time_seconds": round(elapsed_time, 2),
                        "timestamp": time.time(),
                    }
                ),
            )
        except Exception as e:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: Error during processing options streaming",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "output_type": output_type,
                        "error": str(e),
                        "chunk_count": chunk_count,
                        "total_chars": total_chars,
                        "timestamp": time.time(),
                    }
                ),
                exc_info=True,
            )
            yield f"data: {json.dumps({'type': 'error', 'error': f'Error during streaming: {e!s}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    logger.info(
        "%s %s",
        "[ArtefactRoutes] EVENT: Returning processing options streaming response",
        json.dumps(
            {
                "chat_session_id": chat_session_id,
                "output_type": output_type,
                "media_type": "text/event-stream",
                "timestamp": time.time(),
            }
        ),
    )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/graph",
    response_model=ArtefactResponse,
    summary="Create a graph artefact (Mermaid) from a chat session and return the full diagram source",
)
async def create_graph_artefact(
    chat_session_id: str = Query(..., description="Chat session ID"),
    model: str = Query(None, description="Model to use for generation"),
    artefact_id: str = Query(
        None, description="Optional existing artefact ID to update instead of creating new one"
    ),
    # Accept retry context from request body (client sends JSON body)
    previous_invalid: str | None = Body(None),
    previous_error: str | None = Body(None),
    selected_option: dict | None = Body(None, description="User-selected processing option to guide mermaid generation"),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # Log incoming request including retry context if present
    try:
        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Graph artefact creation request received",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "model": model or "default",
                    "artefact_id": artefact_id or "none",
                    "has_previous_invalid": previous_invalid is not None,
                    "previous_invalid_length": len(previous_invalid) if previous_invalid else 0,
                    "has_previous_error": previous_error is not None,
                    "previous_error": previous_error or "",
                    "timestamp": time.time(),
                }
            ),
        )
    except Exception:
        # Best-effort logging only
        pass

    # Validate chat session ID format
    try:
        uuid.UUID(chat_session_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid chat session ID format: {chat_session_id}"
        ) from None

    mermaid_service = get_mermaid_export_service(db)

    # Build the full Mermaid source using non-streaming generation with internal retry
    try:
        mermaid_source = mermaid_service.generate_mermaid_llm_non_streaming(
            chat_session_id,
            model=model,
            previous_invalid=previous_invalid,
            previous_error=previous_error,
            selected_option=selected_option,
        )
    except Exception as e:
        logger.error("[ArtefactRoutes] Error during mermaid generation: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error during mermaid generation: {e!s}")

    if not mermaid_source.strip():
        raise HTTPException(status_code=500, detail="Empty mermaid output")

    # Save artefact and return it
    start_time = time.time()
    try:
        if artefact_id:
            existing_artefact = db.query(Artefact).filter(Artefact.id == artefact_id).first()
            if existing_artefact:
                # Generate descriptive text for the mermaid diagram
                try:
                    description_service = ArtefactDescriptionService(db)
                    descriptive_text = description_service.generate_mermaid_description(
                        mermaid_source, chat_session_id
                    )
                except Exception as desc_error:
                    logger.warning(f"Failed to generate mermaid description: {desc_error}")
                    descriptive_text = f"Mermaid diagram artifact generated from conversation {chat_session_id}"
                
                existing_artefact.current_data = {"mermaid": mermaid_source}
                existing_artefact.type = ArtefactType.graph
                existing_artefact.descriptive_text = descriptive_text
                # Persist selected option if provided
                if selected_option is not None:
                    existing_artefact.selected_processing_option = selected_option
                    if not existing_artefact.processing_output_type:
                        existing_artefact.processing_output_type = "mermaid"
                db.commit()
                db.refresh(existing_artefact)
                ARTEFACTS_CREATED.labels("graph").inc()
                ARTEFACT_PROCESSING_SECONDS.labels("graph", "success").observe(time.time() - start_time)
                return existing_artefact
            # If provided artefact not found, create a new one
        # Generate descriptive text for the mermaid diagram
        try:
            description_service = ArtefactDescriptionService(db)
            descriptive_text = description_service.generate_mermaid_description(
                mermaid_source, chat_session_id
            )
        except Exception as desc_error:
            logger.warning(f"Failed to generate mermaid description: {desc_error}")
            descriptive_text = f"Mermaid diagram artifact generated from conversation {chat_session_id}"
        
        new_artefact_id = uuid.uuid4()
        # current_user is already available from dependency injection
        artefact = Artefact(
            id=new_artefact_id,
            user_id=current_user.id,
            type=ArtefactType.graph,
            current_data={"mermaid": mermaid_source},
            descriptive_text=descriptive_text,
        )
        if selected_option is not None:
            artefact.selected_processing_option = selected_option
            artefact.processing_output_type = "mermaid"
        db.add(artefact)
        db.commit()
        db.refresh(artefact)
        ARTEFACTS_CREATED.labels("graph").inc()
        ARTEFACT_PROCESSING_SECONDS.labels("graph", "success").observe(time.time() - start_time)
        return artefact
    except Exception as save_error:
        logger.error(
            "[ArtefactRoutes] Error saving mermaid artefact: %s",
            str(save_error),
            exc_info=True,
        )
        db.rollback()
        ARTEFACT_ERRORS.labels("graph", "save_error").inc()
        ARTEFACT_PROCESSING_SECONDS.labels("graph", "error").observe(time.time() - start_time)
        raise HTTPException(status_code=500, detail=f"Error saving artefact: {save_error!s}")


@router.post("/graph/test", summary="Test endpoint to stream a sample Mermaid diagram")
async def create_test_graph_artefact(db: Session = Depends(get_db)):
    sample = (
        "graph TD\n"
        "  A[User] -->|creates| B[Chat Session]\n"
        "  B -->|generates| C[Mermaid Diagram]\n"
        "  C --> D[Graph Artefact]\n"
        "  classDef accent fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;\n"
        "  class C accent;\n"
    )

    async def event_stream():
        for line in sample.split("\n"):
            if line:
                content_with_newline = line + "\n"
                payload = {"type": "token", "content": content_with_newline}
                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0.05)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    )
@router.post(
    "/document/test",
    summary="Test endpoint to create a document artefact with sample data",
)
async def create_test_document_artefact(db: Session = Depends(get_db)):
    """
    Test endpoint to create a document artefact with sample markdown content.
    This endpoint doesn't require authentication for testing purposes.
    """
    logger.info("[ArtefactRoutes] Creating test document artefact")

    async def event_stream():
        test_content = """# **Test Document**

This is a test document generated from the backend.

## **Features**

- **Markdown Support**: Full markdown rendering
- **Streaming**: Real-time content streaming
- **Integration**: Connected to the frontend DocumentNode

## **Code Example**

```python
def create_document():
    return "Hello, World!"
```

## **Next Steps**

1. Test the streaming functionality
2. Verify markdown rendering
3. Connect to real chat sessions

---

*This is a test document created for development purposes.*
"""
        logger.info("[ArtefactRoutes] Streaming test content")

        # Stream test content as JSON events
        for chunk in test_content.split("\n"):
            if chunk.strip():
                content_with_newline = chunk + "\n"
                yield f"data: {json.dumps({'type': 'token', 'content': content_with_newline})}\n\n"
                await asyncio.sleep(0.1)  # Small delay for visual effect

        # Save the test artefact after streaming
        try:
            artefact_id = uuid.uuid4()
            logger.info(f"[ArtefactRoutes] Saving test artefact {artefact_id}")

            artefact = Artefact(
                id=artefact_id,
                user_id=None,  # Test endpoint - no user association
                type=ArtefactType.document,
                current_data={"markdown": test_content},
            )
            db.add(artefact)
            db.commit()
            logger.info(
                f"[ArtefactRoutes] Successfully saved test artefact {artefact_id}"
            )
        except Exception as e:
            logger.error(f"[ArtefactRoutes] Error saving test artefact: {e!s}")
            db.rollback()

        # Send completion signal
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    )


@router.post(
    "/cleanup-duplicates", summary="Clean up duplicate content in existing artefacts"
)
def cleanup_duplicate_content(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Clean up duplicate content in existing document artefacts.
    This is a utility endpoint to fix artefacts that were created before the duplicate prevention was implemented.
    """
    logger.info("[ArtefactRoutes] Starting duplicate content cleanup")

    try:
        # Get all document artefacts
        artefacts = (
            db.query(Artefact).filter(Artefact.type == ArtefactType.document).all()
        )
        cleaned_count = 0
        total_count = len(artefacts)

        md_service = get_markdown_export_service(db)

        for artefact in artefacts:
            if artefact.current_data and "markdown" in artefact.current_data:
                original_content = artefact.current_data["markdown"]
                cleaned_content = md_service._clean_duplicate_content(original_content)

                if cleaned_content != original_content:
                    artefact.current_data["markdown"] = cleaned_content
                    cleaned_count += 1
                    logger.info(
                        f"[ArtefactRoutes] Cleaned artefact {artefact.id}: {len(original_content)} -> {len(cleaned_content)} characters"
                    )

        db.commit()

        logger.info(
            f"[ArtefactRoutes] Duplicate cleanup completed: {cleaned_count}/{total_count} artefacts cleaned"
        )

        return {
            "message": "Duplicate cleanup completed",
            "total_artefacts": total_count,
            "cleaned_artefacts": cleaned_count,
        }

    except Exception as e:
        logger.error(
            f"[ArtefactRoutes] Error during duplicate cleanup: {e!s}", exc_info=True
        )
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error during cleanup: {e!s}"
        ) from e


@router.post(
    "/table",
    response_model=ArtefactResponse,
    summary="Create a table artefact from a chat session and stream the JSON table output",
)
async def create_table_artefact(
    chat_session_id: str = Query(..., description="Chat session ID"),
    model: str = Query(None, description="Model to use for generation"),
    artefact_id: str = Query(
        None,
        description="Optional existing artefact ID to update instead of creating new one",
    ),
    selected_option: dict | None = Body(None, description="User-selected processing option to guide table generation"),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a table artefact by generating a structured JSON table from a chat session (via LLM),
    stream the JSON table output as JSON events, and save the result as an artefact after streaming is complete.
    """
    logger.info(
        "%s %s",
        "[ArtefactRoutes] EVENT: Table artefact creation request received",
        json.dumps(
            {
                "chat_session_id": chat_session_id,
                "model": model or "default",
                "artefact_id": artefact_id or "none",
                "user_id": current_user.clerk_user_id,
                "timestamp": time.time(),
            }
        ),
    )

    # Validate chat session ID format
    try:
        uuid.UUID(chat_session_id)
        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Chat session ID validation passed",
            json.dumps({"chat_session_id": chat_session_id, "timestamp": time.time()}),
        )
    except ValueError:
        logger.error(
            "%s %s",
            "[ArtefactRoutes] EVENT: Invalid chat session ID format",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "error": "invalid_uuid_format",
                    "timestamp": time.time(),
                }
            ),
        )
        raise HTTPException(
            status_code=400, detail=f"Invalid chat session ID format: {chat_session_id}"
        ) from None

    table_service = TableExportService(db)

    async def event_stream():
        # Initialize artefact_id variable for error handling
        current_artefact_id = artefact_id

        # Validate that we have a valid database session
        if not db:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: No database session available",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "error": "no_database_session",
                        "timestamp": time.time(),
                    }
                ),
            )
            yield f"data: {json.dumps({'type': 'error', 'error': 'Database connection not available'})}\n\n"
            return

        logger.info(
            "%s %s",
            "[ArtefactRoutes] EVENT: Starting table JSON streaming",
            json.dumps(
                {
                    "chat_session_id": chat_session_id,
                    "model": model or "default",
                    "timestamp": time.time(),
                }
            ),
        )
        chunk_count = 0
        total_chars = 0
        table_json_content = ""
        start_time = time.time()

        try:
            for chunk in table_service.stream_session_table_json_structured(
                chat_session_id, model=model, selected_option=selected_option
            ):
                table_json_content += chunk
                chunk_count += 1
                total_chars += len(chunk)

                # Stream chunk as JSON event (same format as document endpoint)
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            elapsed_time = time.time() - start_time
            logger.info(
                "%s %s",
                "[ArtefactRoutes] EVENT: Table JSON streaming completed",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "total_chunks": chunk_count,
                        "total_chars": total_chars,
                        "elapsed_time_seconds": round(elapsed_time, 2),
                        "timestamp": time.time(),
                    }
                ),
            )

            # Save the artefact after streaming is complete
            if table_json_content.strip():
                try:
                    if current_artefact_id:
                        # Update existing artefact
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: Updating existing table artefact",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "artefact_id": current_artefact_id,
                                    "content_length": len(table_json_content),
                                    "timestamp": time.time(),
                                }
                            ),
                        )

                        existing_artefact = (
                            db.query(Artefact)
                            .filter(Artefact.id == current_artefact_id)
                            .first()
                        )
                        if existing_artefact:
                            # Parse the table JSON to generate description
                            try:
                                table_data = json.loads(table_json_content)
                                description_service = ArtefactDescriptionService(db)
                                descriptive_text = description_service.generate_table_description(
                                    table_data, chat_session_id
                                )
                            except Exception as desc_error:
                                logger.warning(f"Failed to generate table description: {desc_error}")
                                descriptive_text = f"Table artifact generated from conversation {chat_session_id}"
                            
                            existing_artefact.current_data = {
                                "table_json": table_json_content
                            }
                            existing_artefact.type = ArtefactType.table
                            existing_artefact.descriptive_text = descriptive_text
                            if selected_option is not None:
                                existing_artefact.selected_processing_option = selected_option
                                if not existing_artefact.processing_output_type:
                                    existing_artefact.processing_output_type = "table"
                            db.commit()
                            logger.info(
                                "%s %s",
                                "[ArtefactRoutes] EVENT: Existing table artefact updated successfully",
                                json.dumps(
                                    {
                                        "chat_session_id": chat_session_id,
                                        "artefact_id": current_artefact_id,
                                        "timestamp": time.time(),
                                    }
                                ),
                            )
                        else:
                            logger.error(
                                "%s %s",
                                "[ArtefactRoutes] EVENT: Existing artefact not found for update",
                                json.dumps(
                                    {
                                        "chat_session_id": chat_session_id,
                                        "artefact_id": current_artefact_id,
                                        "timestamp": time.time(),
                                    }
                                ),
                            )
                    else:
                        # Create new artefact
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: Creating new table artefact",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "content_length": len(table_json_content),
                                    "timestamp": time.time(),
                                }
                            ),
                        )

                        # Parse the table JSON to generate description
                        try:
                            table_data = json.loads(table_json_content)
                            description_service = ArtefactDescriptionService(db)
                            descriptive_text = description_service.generate_table_description(
                                table_data, chat_session_id
                            )
                        except Exception as desc_error:
                            logger.warning(f"Failed to generate table description: {desc_error}")
                            descriptive_text = f"Table artifact generated from conversation {chat_session_id}"
                        
                        # current_user is already available from dependency injection
                        new_artefact = Artefact(
                            user_id=current_user.id,
                            type=ArtefactType.table,
                            current_data={"table_json": table_json_content},
                            descriptive_text=descriptive_text,
                        )
                        if selected_option is not None:
                            new_artefact.selected_processing_option = selected_option
                            new_artefact.processing_output_type = "table"
                        db.add(new_artefact)
                        db.commit()
                        db.refresh(new_artefact)

                        current_artefact_id = str(new_artefact.id)
                        logger.info(
                            "%s %s",
                            "[ArtefactRoutes] EVENT: New table artefact created successfully",
                            json.dumps(
                                {
                                    "chat_session_id": chat_session_id,
                                    "artefact_id": current_artefact_id,
                                    "timestamp": time.time(),
                                }
                            ),
                        )

                except Exception as save_error:
                    logger.error(
                        "%s %s",
                        "[ArtefactRoutes] EVENT: Error saving table artefact",
                        json.dumps(
                            {
                                "chat_session_id": chat_session_id,
                                "artefact_id": (
                                    current_artefact_id if current_artefact_id else "new"
                                ),
                                "error": str(save_error),
                                "timestamp": time.time(),
                            }
                        ),
                        exc_info=True,
                    )
                    db.rollback()
            else:
                logger.warning(
                    "%s %s",
                    "[ArtefactRoutes] EVENT: No content to save",
                    json.dumps(
                        {
                            "chat_session_id": chat_session_id,
                            "content_length": len(table_json_content),
                            "timestamp": time.time(),
                        }
                    ),
                )

        except Exception as e:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: Error during table JSON streaming",
                json.dumps(
                    {
                        "chat_session_id": chat_session_id,
                        "error": str(e),
                        "chunk_count": chunk_count,
                        "total_chars": total_chars,
                        "timestamp": time.time(),
                    }
                ),
                exc_info=True,
            )
            yield f"data: {json.dumps({'type': 'error', 'error': f'Error during streaming: {e!s}'})}\n\n"
        finally:
            # Send completion signal
            yield "data: [DONE]\n\n"

    logger.info(
        "%s %s",
        "[ArtefactRoutes] EVENT: Returning table streaming response",
        json.dumps(
            {
                "chat_session_id": chat_session_id,
                "media_type": "text/event-stream",
                "timestamp": time.time(),
            }
        ),
    )
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/table/test", summary="Test endpoint to create a table artefact with sample data"
)
async def create_test_table_artefact(db: Session = Depends(get_db)):
    """
    Test endpoint to create a table artefact with sample data for development/testing purposes.
    """
    logger.info("[ArtefactRoutes] EVENT: Test table artefact creation request received")

    table_service = TableExportService(db)

    async def event_stream():
        logger.info("[ArtefactRoutes] EVENT: Starting test table JSON streaming")
        chunk_count = 0
        total_chars = 0
        start_time = time.time()

        try:
            # Use a sample chat session ID for testing
            sample_session_id = "00000000-0000-0000-0000-000000000000"

            for chunk in table_service.stream_session_table_json_structured(
                sample_session_id
            ):
                chunk_count += 1
                total_chars += len(chunk)

                # Stream chunk as JSON event
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            elapsed_time = time.time() - start_time
            logger.info(
                "%s %s",
                "[ArtefactRoutes] EVENT: Test table JSON streaming completed",
                json.dumps(
                    {
                        "total_chunks": chunk_count,
                        "total_chars": total_chars,
                        "elapsed_time_seconds": round(elapsed_time, 2),
                        "timestamp": time.time(),
                    }
                ),
            )

        except Exception as e:
            logger.error(
                "%s %s",
                "[ArtefactRoutes] EVENT: Error during test table JSON streaming",
                json.dumps(
                    {
                        "error": str(e),
                        "chunk_count": chunk_count,
                        "total_chars": total_chars,
                        "timestamp": time.time(),
                    }
                ),
                exc_info=True,
            )
            yield f"data: {json.dumps({'type': 'error', 'error': f'Error during test streaming: {e!s}'})}\n\n"
        finally:
            # Send completion signal
            yield "data: [DONE]\n\n"

    logger.info("[ArtefactRoutes] EVENT: Returning test table streaming response")
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "X-Content-Type-Options": "nosniff",
        },
    )
