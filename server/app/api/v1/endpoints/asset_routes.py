import asyncio

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
import time
from fastapi.responses import FileResponse, Response
# Authentication handled by centralized require_auth decorator
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.core.security_utils import SecurityUtils
from app.core.rate_limiter import limiter, UPLOAD_RATE_LIMIT
from app.db.database import get_db
from app.db.models.asset import Asset, AssetStatus, AssetType, DocumentType
from app.schemas.common import AssetResponse, AssetUpdate

from app.db.database import SessionLocal
from app.services.rag_services.pdf_summary_service import ( PDFSummaryService,)

# get_current_user now handled by standardized require_auth() decorator
from app.core.auth_decorators import require_auth
from app.db.models.node import Node
from app.models.user import User as DBUser




# NEW: Import our new asset services
from app.services.assets.background_processor import process_asset_async
from app.services.rag_services.file_storage_service import file_storage_service
from app.services.metrics import ASSET_INGEST_ERRORS, ASSET_INGEST_SECONDS
from app.services.rag_services.pdf_processing_service import PDFProcessingService

# Authentication handled by centralized require_auth decorator

router = APIRouter(prefix="/graphs/{graph_id}/assets", tags=["Asset"])


# New request model for URL updates
class AssetUrlUpdateRequest(BaseModel):
    url: str


@router.post(
    "/", response_model=AssetResponse, summary="Create an asset node (upload or URL)"
)
def create_asset(
    graph_id: str,
    asset_type: AssetType = Form(...),
    source: str = Form(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create an asset node by uploading a file or providing a URL. Requires Clerk authentication.
    """

    # current_user is already available from dependency injection

    start_time = time.time()
    db_asset = Asset(
        user_id=current_user.id,  # Use database UUID, not Clerk string ID
        type=asset_type,
        source=source,
        status=AssetStatus.processing,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    ASSET_INGEST_SECONDS.labels(asset_type.value, "success").observe(time.time() - start_time)
    return db_asset


@router.post(
    "/upload-pdf",
    response_model=AssetResponse,
    summary="Upload and process a PDF file directly",
)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_pdf_file(
    request: Request,
    graph_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Upload a PDF file directly and process it immediately.
    This stores the file permanently and processes it for Q&A.
    NOW USES NEW ASSET SERVICE ARCHITECTURE
    """
    
    # Generate request ID for tracking
    request_id = SecurityUtils.generate_request_id()
    logger.info(f"[{request_id}] PDF upload request started")

    # Validate file type
    if not SecurityUtils.validate_file_type(file.content_type or "", ["application/pdf"]):
        raise HTTPException(
            status_code=400, 
            detail="Only PDF files are allowed"
        )
    
    # Validate file size
    if file.size and not SecurityUtils.validate_file_size(file.size, settings.MAX_FILE_SIZE_MB):
        raise HTTPException(
            status_code=400, 
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )

    # current_user is already available from dependency injection

    # Create asset record first
    start_time = time.time()
    sanitized_filename = SecurityUtils.sanitize_filename(file.filename or "uploaded.pdf")
    db_asset = Asset(
        user_id=current_user.id,  # Use database UUID, not Clerk string ID
        type=AssetType.pdf,
        source=sanitized_filename,  # Store sanitized filename
        status=AssetStatus.processing,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)

    # Store the file permanently using the file storage service
    try:
        file_path = await file_storage_service.store_file(file, str(db_asset.id))

        # Update the asset with the file path
        db_asset.file_path = file_path
        db.commit()

        logger.info(
            f"Stored PDF file {file.filename} at {file_path} for asset {db_asset.id}"
        )

        # NEW: Use the new asset service architecture
        asyncio.create_task(
            process_asset_async(
                str(db_asset.id),
                str(current_user.id),  # Use database UUID as string
                db,
            )
        )

    except Exception as e:
        logger.error(f"[{request_id}] Failed to store or process uploaded PDF: {e!s}")
        db_asset.status = AssetStatus.failed
        db.commit()
        ASSET_INGEST_ERRORS.labels("pdf", e.__class__.__name__).inc()
        ASSET_INGEST_SECONDS.labels("pdf", "error").observe(time.time() - start_time)
        
        # Use sanitized error message for user
        sanitized_message = SecurityUtils.sanitize_error_message(e, request)
        raise HTTPException(status_code=500, detail=sanitized_message) from e

    return db_asset


@router.post(
    "/create-from-placeholder",
    response_model=AssetResponse,
    summary="Create asset from placeholder PDF node",
)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def create_asset_from_placeholder(
    request: Request,
    graph_id: str,
    placeholder_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a real Asset from a placeholder PDF node when user uploads their first file.
    This also updates the node's content_id to point to the new Asset.
    """
    
    # Generate request ID for tracking
    request_id = SecurityUtils.generate_request_id()
    logger.info(f"[{request_id}] Create asset from placeholder request started")

    # Validate file type
    if not SecurityUtils.validate_file_type(file.content_type or "", ["application/pdf"]):
        raise HTTPException(
            status_code=400, 
            detail="Only PDF files are allowed"
        )
    
    # Validate file size
    if file.size and not SecurityUtils.validate_file_size(file.size, settings.MAX_FILE_SIZE_MB):
        raise HTTPException(
            status_code=400, 
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit"
        )

    # current_user is already available from dependency injection

    # Find the node with this placeholder content_id
    placeholder_node = db.query(Node).filter(Node.content_id == placeholder_id).first()
    if not placeholder_node:
        raise HTTPException(status_code=404, detail="Placeholder node not found")

    # Create the real Asset with the database user ID (UUID)
    start_time = time.time()
    db_asset = Asset(
        user_id=current_user.id,  # Use database UUID, not Clerk string ID
        type=AssetType.pdf,
        source=file.filename or "uploaded.pdf",
        status=AssetStatus.processing,
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)

    # Update the node to point to the real Asset
    placeholder_node.content_id = str(db_asset.id)
    db.commit()

    # Store the file and start processing
    try:
        file_path = await file_storage_service.store_file(file, str(db_asset.id))

        # Update the asset with the file path
        db_asset.file_path = file_path
        db.commit()

        logger.info(
            f"Created real Asset {db_asset.id} from placeholder {placeholder_id} with file {file.filename}"
        )

        # Process the uploaded file immediately with database user ID
        asyncio.create_task(
            process_asset_async(
                str(db_asset.id),
                str(current_user.id),  # Use database UUID as string
                db,
            )
        )

        logger.info(
            f"Started processing uploaded PDF {file.filename} for new asset {db_asset.id} using new service architecture"
        )

        # Return the created asset
        return db_asset

    except Exception as e:
        logger.error(f"[{request_id}] Failed to store or process uploaded PDF for new asset: {e!s}")
        db_asset.status = AssetStatus.failed
        db.commit()
        ASSET_INGEST_ERRORS.labels("pdf", e.__class__.__name__).inc()
        ASSET_INGEST_SECONDS.labels("pdf", "error").observe(time.time() - start_time)
        
        # Use sanitized error message for user
        sanitized_message = SecurityUtils.sanitize_error_message(e, request)
        raise HTTPException(status_code=500, detail=sanitized_message) from e


@router.get(
    "/{asset_id}",
    response_model=AssetResponse,
    summary="Get asset status and transcript",
)
def get_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get the status and transcript of an asset node. Requires Clerk authentication.
    """

    # current_user is already available from dependency injection

    # Query asset with user isolation
    asset = (
        db.query(Asset)
        .filter(
            Asset.id == asset_id,
            Asset.user_id == current_user.id,  # Use database UUID for security
        )
        .first()
    )

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset


@router.put(
    "/{asset_id}",
    response_model=AssetResponse,
    summary="Update asset metadata or reprocess",
)
def update_asset(
    asset_id: str,
    asset: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update asset metadata (e.g., title, reprocess). Requires Clerk authentication.
    """

    # current_user is already available from dependency injection

    # Query asset with user isolation
    db_asset = (
        db.query(Asset)
        .filter(
            Asset.id == asset_id,
            Asset.user_id == current_user.id,  # Use database UUID for security
        )
        .first()
    )

    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for k, v in asset.dict(exclude_unset=True).items():
        setattr(db_asset, k, v)
    db.commit()
    db.refresh(db_asset)
    return db_asset


# only start processing transcipt, after user has input the url
@router.put(
    "/{asset_id}/url",
    response_model=AssetResponse,
    summary="Update asset URL and trigger transcript processing",
)
async def update_asset_url_and_process(
    asset_id: str,
    request: AssetUrlUpdateRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update asset URL and trigger transcript processing in the background.
    This is the new endpoint that replaces direct frontend calls to the microservice.
    Note: PDF processing via URL is disabled - use file upload instead.
    NOW USES NEW ASSET SERVICE ARCHITECTURE
    """

    # current_user is already available from dependency injection

    # Find the asset with user isolation
    db_asset = (
        db.query(Asset)
        .filter(
            Asset.id == asset_id,
            Asset.user_id == current_user.id,  # Use database UUID for security
        )
        .first()
    )

    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Update the URL and set status to processing
    db_asset.source = request.url
    start_time = time.time()
    db_asset.status = AssetStatus.processing
    db_asset.transcript = None  # Clear old transcript
    db.commit()
    db.refresh(db_asset)

    # NEW: Use the new asset service architecture
    if db_asset.type in [AssetType.youtube, AssetType.instagram]:
        # Use the new background processor for media assets
        asyncio.create_task(
            process_asset_async(
                str(db_asset.id),
                str(current_user.id),  # Use database UUID as string
                db,
            )
        )
        logger.info(
            f"Started processing {db_asset.type} URL for asset {db_asset.id} using new service architecture"
        )
    elif db_asset.type == AssetType.pdf:
        # PDF processing via URL is disabled - return error
        db_asset.status = AssetStatus.failed
        db.commit()
        ASSET_INGEST_ERRORS.labels("pdf", "url_not_supported").inc()
        ASSET_INGEST_SECONDS.labels("pdf", "error").observe(time.time() - start_time)
        raise HTTPException(
            status_code=400,
            detail="PDF processing via URL is not supported. Please use file upload instead.",
        )
    else:
        # For other asset types, use the new service architecture
        asyncio.create_task(
            process_asset_async(
                str(db_asset.id),
                str(current_user.id),  # Use database UUID as string
                db,
            )
        )
        logger.info(
            f"Started processing {db_asset.type} URL for asset {db_asset.id} using new service architecture"
        )

    ASSET_INGEST_SECONDS.labels(db_asset.type.value, "success").observe(time.time() - start_time)
    return db_asset


async def process_youtube_transcript(asset_id: str, url: str, db: Session):
    """
    Process YouTube transcript in the background and update the asset.
    This is where we call the Python microservice from the backend.
    """
    try:
        logger.info(
            f"Processing YouTube transcript for asset {asset_id}, URL: {url}, microservice url: {settings.PYTHON_TRANSCRIPT_SERVICE_URL}"
        )

        # Call the Python microservice
        # Use configured URL if available; otherwise default to the Docker service name
        # "transcript-service" resolves to the microservice container on the shared network
        python_service_url = (
            settings.PYTHON_TRANSCRIPT_SERVICE_URL or "http://transcript-service:5001"
        )
        python_service_api_key = settings.PYTHON_TRANSCRIPT_SERVICE_API_KEY

        if not python_service_api_key:
            logger.error("Python transcript service API key not configured")
            await update_asset_status(
                asset_id, AssetStatus.failed, "Service not configured", db
            )
            return

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{python_service_url}/transcript/youtube",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": python_service_api_key,
                },
                json={"url": url},
                timeout=120.0,  # 2 minutes timeout
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("transcript", "")

                # Update the asset with the transcript
                await update_asset_status(
                    asset_id, AssetStatus.completed, transcript, db
                )
                logger.info(
                    f"Successfully processed YouTube transcript for asset {asset_id}"
                )

            else:
                error_data = (
                    response.json()
                    if response.headers.get("content-type") == "application/json"
                    else {}
                )
                error_message = error_data.get("error", f"HTTP {response.status_code}")
                logger.error(
                    f"Failed to process YouTube transcript for asset {asset_id}: {error_message}"
                )
                await update_asset_status(
                    asset_id,
                    AssetStatus.failed,
                    f"Transcript extraction failed: {error_message}",
                    db,
                )

    except Exception as e:
        logger.error(
            f"Exception processing YouTube transcript for asset {asset_id}: {e!s}"
        )
        await update_asset_status(
            asset_id, AssetStatus.failed, f"Processing error: {e!s}", db
        )


async def process_instagram_transcript(asset_id: str, url: str, db: Session):
    """
    Process Instagram transcript in the background and update the asset.
    """
    try:
        logger.info(f"Processing Instagram transcript for asset {asset_id}, URL: {url}")

        # Call the Python microservice (assuming similar endpoint exists)
        # Use configured URL if available; otherwise default to the Docker service name
        python_service_url = (
            settings.PYTHON_TRANSCRIPT_SERVICE_URL or "http://transcript-service:5001"
        )
        python_service_api_key = settings.PYTHON_TRANSCRIPT_SERVICE_API_KEY

        if not python_service_api_key:
            logger.error("Python transcript service API key not configured")
            await update_asset_status(
                asset_id, AssetStatus.failed, "Service not configured", db
            )
            return

        async with httpx.AsyncClient() as client:
            # Note: You might need to create an Instagram endpoint in your Python service
            response = await client.post(
                f"{python_service_url}/transcript/instagram",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": python_service_api_key,
                },
                json={"url": url},
                timeout=120.0,
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("transcript", "")

                await update_asset_status(
                    asset_id, AssetStatus.completed, transcript, db
                )
                logger.info(
                    f"Successfully processed Instagram transcript for asset {asset_id}"
                )

            else:
                error_data = (
                    response.json()
                    if response.headers.get("content-type") == "application/json"
                    else {}
                )
                error_message = error_data.get("error", f"HTTP {response.status_code}")
                logger.error(
                    f"Failed to process Instagram transcript for asset {asset_id}: {error_message}"
                )
                await update_asset_status(
                    asset_id,
                    AssetStatus.failed,
                    f"Transcript extraction failed: {error_message}",
                    db,
                )

    except Exception as e:
        logger.error(
            f"Exception processing Instagram transcript for asset {asset_id}: {e!s}"
        )
        await update_asset_status(
            asset_id, AssetStatus.failed, f"Processing error: {e!s}", db
        )


async def update_asset_status(
    asset_id: str, status: AssetStatus, transcript_or_error: str, db: Session
):
    """
    Update asset status and transcript/error message.
    """
    try:
        # Create a new session for the background task

        with SessionLocal() as session:
            asset = session.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = status
                if status == AssetStatus.completed:
                    asset.transcript = transcript_or_error
                else:
                    # For failed status, we could add an error field to the Asset model
                    # For now, we'll just log it
                    logger.error(f"Asset {asset_id} failed: {transcript_or_error}")

                session.commit()
                logger.info(f"Updated asset {asset_id} status to {status}")
            else:
                logger.error(f"Asset {asset_id} not found for status update")

    except Exception as e:
        # Use structured logging to avoid bandit warnings
        logger.error(
            "Failed to update asset status",
            extra={
                "asset_id": asset_id,
                "error": str(e),
                "operation": "update_asset_status",
            },
        )


async def update_pdf_asset_status(
    asset_id: str,
    status: AssetStatus,
    extracted_text: str,
    token_count: int,
    document_type,
    db: Session,
):
    """
    Update PDF asset with extracted text, token count, and document classification.
    This is a specialized version of update_asset_status for PDF-specific data.
    """
    try:
        # Create a new session for the background task

        with SessionLocal() as session:
            asset = session.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = status
                # Always store PDF-specific data regardless of status
                asset.extracted_text = extracted_text
                asset.token_count = token_count
                asset.document_type = document_type
                # Note: We only use extracted_text for PDFs, not transcript

                session.commit()
                logger.info(f"Updated PDF asset {asset_id} status to {status}")
            else:
                logger.error(f"PDF asset {asset_id} not found for status update")

    except Exception as e:
        logger.error(f"Failed to update PDF asset {asset_id} status: {e!s}")


async def update_pdf_asset_status_with_summary(
    asset_id: str,
    status: AssetStatus,
    extracted_text: str,
    token_count: int,
    document_type,
    summary: str | None,
    db: Session,
):
    """
    Update PDF asset with extracted text, token count, document classification, and summary.
    This is an enhanced version that includes summary generation.
    """
    try:
        # Create a new session for the background task

        with SessionLocal() as session:
            asset = session.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = status
                if status == AssetStatus.completed:
                    # Store PDF-specific data
                    asset.extracted_text = extracted_text
                    asset.token_count = token_count
                    asset.document_type = document_type
                    asset.summary = summary  # Store the generated summary
                    # Note: We only use extracted_text for PDFs, not transcript

                session.commit()
                logger.info(
                    f"Updated PDF asset {asset_id} status to {status} with summary: {bool(summary)}"
                )
            else:
                logger.error(f"PDF asset {asset_id} not found for status update")

    except Exception as e:
        logger.error(f"Failed to update PDF asset {asset_id} status: {e!s}")


async def process_uploaded_pdf_from_storage(
    asset_id: str, file_path: str, filename: str, user_id: str, db: Session
):
    """
    Process a PDF file that's permanently stored in the file storage system.
    Now includes automatic summary generation for short documents and RAG processing for long documents.
    """
    try:
        logger.info(
            f"Processing stored PDF asset {asset_id}, file: {filename}, user: {user_id}"
        )

        # Get the absolute path to the stored file
        absolute_path = await file_storage_service.get_file_path(file_path)
        if not absolute_path:
            logger.error(f"Stored file not found: {file_path}")
            await update_asset_status(
                asset_id, AssetStatus.failed, f"Stored file not found: {file_path}", db
            )
            return

        # Initialize PDF processing service
        pdf_service = PDFProcessingService()

        # Process the PDF (extract text, count tokens, classify)
        try:
            extracted_text, token_count, document_type = await pdf_service.process_pdf(
                str(absolute_path)
            )

            # For short documents, complete the processing immediately with summary
            if document_type == DocumentType.short:
                # Update the asset in the database with basic information
                await update_pdf_asset_status(
                    asset_id,
                    AssetStatus.completed,
                    extracted_text,
                    token_count,
                    document_type,
                    db,
                )

                # Generate summary for short documents

                with SessionLocal() as session:
                    asset = session.query(Asset).filter(Asset.id == asset_id).first()
                    if asset:
                        

                        summary_service = PDFSummaryService()

                        summary = summary_service.generate_summary(asset)
                        if summary:
                            asset.summary = summary
                            session.commit()
                            logger.info(f"Generated summary for short PDF {asset_id}")
                        else:
                            logger.warning(
                                f"Failed to generate summary for PDF {asset_id}"
                            )

            # For long documents, keep processing status until everything is complete
            elif document_type == DocumentType.long:
                # Update asset with extracted text but keep status as processing
                await update_pdf_asset_status(
                    asset_id,
                    AssetStatus.processing,
                    extracted_text,
                    token_count,
                    document_type,
                    db,
                )

                # Create a new session to get the updated asset for further processing

                with SessionLocal() as session:
                    asset = session.query(Asset).filter(Asset.id == asset_id).first()
                    if not asset:
                        logger.error(
                            f"Asset {asset_id} not found after basic processing"
                        )
                        return

                    # Trigger RAG processing for long documents
                    try:
                        logger.info(
                            f"Starting RAG processing for long PDF {asset_id} for user {user_id}"
                        )

                        rag_result = pdf_service.process_long_pdf(
                            asset, user_id, session
                        )
                        if rag_result["success"]:
                            logger.info(
                                f"RAG processing completed for PDF {asset_id}. Collection: {rag_result['collection_id']}"
                            )

                            # Generate summary for long documents after RAG processing
                          

                            summary_service = PDFSummaryService()

                            logger.info(
                                f"Generating RAG-based summary for long PDF {asset_id}"
                            )
                            summary = summary_service.generate_summary(asset)
                            if summary:
                                asset.summary = summary
                                logger.info(
                                    f"Generated RAG-based summary for long PDF {asset_id}"
                                )
                            else:
                                logger.warning(
                                    f"Failed to generate summary for long PDF {asset_id}"
                                )

                            # Finally mark as completed now that everything is done
                            asset.status = AssetStatus.completed
                            session.commit()
                            logger.info(
                                f"Long PDF {asset_id} processing fully completed"
                            )
                        else:
                            logger.warning(
                                f"RAG processing had issues for PDF {asset_id}"
                            )
                            # Mark as completed anyway since basic processing worked
                            asset.status = AssetStatus.completed
                            session.commit()

                    except Exception as rag_error:
                        logger.error(
                            f"RAG processing failed for PDF {asset_id}: {rag_error!s}"
                        )
                        # Mark as completed since basic PDF processing worked
                        asset.status = AssetStatus.completed
                        session.commit()

            logger.info(
                f"Successfully processed stored PDF asset {asset_id}: {token_count} tokens, type: {document_type.value}"
            )

        except Exception as e:
            logger.error(f"Failed to process PDF text for asset {asset_id}: {e!s}")
            await update_asset_status(
                asset_id, AssetStatus.failed, f"PDF processing error: {e!s}", db
            )

    except Exception as e:
        logger.error(f"Exception processing stored PDF asset {asset_id}: {e!s}")
        await update_asset_status(
            asset_id, AssetStatus.failed, f"Processing error: {e!s}", db
        )


@router.get("/{asset_id}/file", summary="Download or serve a stored asset file")
async def get_asset_file(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Download or serve a stored asset file. Requires Clerk authentication.
    """

    # current_user is already available from dependency injection

    # Query asset with user isolation
    asset = (
        db.query(Asset)
        .filter(
            Asset.id == asset_id,
            Asset.user_id == current_user.id,  # Use database UUID for security
        )
        .first()
    )

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if not asset.file_path:
        raise HTTPException(
            status_code=404, detail="No file associated with this asset"
        )

    # Get the absolute path to the stored file
    absolute_path = await file_storage_service.get_file_path(asset.file_path)
    
    if not absolute_path:
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Check if file actually exists (using async file operations)
    import asyncio
    if not await asyncio.to_thread(absolute_path.exists):
        raise HTTPException(status_code=404, detail="File not found on filesystem")
    
    # Set proper content type for PDFs
    media_type = "application/pdf" if asset.source.lower().endswith('.pdf') else "application/octet-stream"
    
    # Create FileResponse with proper headers
    response = FileResponse(
        path=absolute_path,
        filename=asset.source,
        media_type=media_type,
    )
    
    # Add CORS headers to allow frontend access
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Range, If-None-Match, If-Modified-Since"
    
    # Add support for range requests (important for PDF.js)
    response.headers["Accept-Ranges"] = "bytes"
    
    return response


@router.options("/{asset_id}/file", summary="CORS preflight for asset file download")
def options_asset_file(asset_id: str):
    """Handle CORS preflight requests for asset file downloads."""
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Range, If-None-Match, If-Modified-Since"
    response.headers["Access-Control-Max-Age"] = "86400"  # Cache preflight for 24 hours
    return response


@router.post(
    "/{asset_id}/upload-file",
    response_model=AssetResponse,
    summary="Upload file to existing asset",
)
async def upload_file_to_asset(
    graph_id: str,
    asset_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Upload a file to an existing asset and process it.
    This updates the existing asset instead of creating a new one.
    """

    # current_user is already available from dependency injection

    # Get the existing asset with user isolation
    db_asset = (
        db.query(Asset)
        .filter(
            Asset.id == asset_id,
            Asset.user_id == current_user.id,  # Use database UUID for security
        )
        .first()
    )
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Store the file permanently using the file storage service
    start_time = time.time()
    try:
        file_path = await file_storage_service.store_file(file, str(db_asset.id))

        # Update the asset with the file info
        db_asset.source = file.filename or "uploaded.pdf"  # Update with actual filename
        db_asset.file_path = file_path
        db_asset.status = AssetStatus.processing  # Reset to processing
        # Clear any previous processing results
        db_asset.extracted_text = None
        db_asset.token_count = None
        db_asset.document_type = None
        db_asset.summary = None
        db_asset.transcript = None
        # Clear RAG-related fields
        db_asset.vector_db_collection_id = None
        db_asset.chunk_count = None
        db_asset.processing_metadata = None
        db.commit()

        logger.info(
            f"Updated asset {asset_id} with uploaded file {file.filename} at {file_path}"
        )

        # Process the uploaded file immediately with database user ID
        asyncio.create_task(
            process_asset_async(
                str(db_asset.id),
                str(current_user.id),  # Use database UUID as string
                db,
            )
        )

        logger.info(
            f"Started processing uploaded PDF {file.filename} for existing asset {db_asset.id} using new service architecture"
        )

    except Exception as e:
        logger.error(
            f"Failed to store or process uploaded PDF for asset {asset_id}: {e!s}"
        )
        db_asset.status = AssetStatus.failed
        db.commit()
        ASSET_INGEST_ERRORS.labels("pdf", e.__class__.__name__).inc()
        ASSET_INGEST_SECONDS.labels("pdf", "error").observe(time.time() - start_time)
        raise HTTPException(
            status_code=500, detail=f"Failed to process uploaded PDF: {e!s}"
        ) from e

    return db_asset
