import json
from datetime import datetime

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.logger import logger
from app.core.rate_limiter import (
    CREATE_RATE_LIMIT,
    READ_RATE_LIMIT,
    limiter,
)
from app.db.database import get_db
from app.db.models.artefact import Artefact
from app.db.models.asset import Asset, AssetStatus, AssetType
from app.db.models.chat_session import ChatSession
from app.db.models.node import Node
from app.models.user import User as DBUser
from app.schemas.common import NodeResponse, NodeUpdate
from app.services.content.firecrawl_service import firecrawl_service
from app.services.user_limits import UserLimitsService

router = APIRouter(prefix="/graphs/{graph_id}/nodes", tags=["Node"])


@router.get("/", response_model=list[NodeResponse], summary="List all nodes in a graph")
@router.get("", response_model=list[NodeResponse], summary="List all nodes in a graph")
@limiter.limit(READ_RATE_LIMIT)
def list_nodes(
    request: Request,
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    List all nodes in a workspace graph. Requires Clerk authentication.
    """
    # SECURITY: Verify graph ownership
    from app.db.models.graph import Graph

    # Verify the graph belongs to the current user
    graph = db.query(Graph).filter(
        Graph.id == graph_id,
        Graph.user_id == current_user.id
    ).first()

    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    nodes = db.query(Node).filter(Node.graph_id == graph_id).all()
    # Convert id and content_id to str for each node
    for node in nodes:
        node.id = str(node.id)
        if node.content_id:
            node.content_id = str(node.content_id)
    return nodes


# --- Atomic Node+Content Creation ---
class NodeContentCreateRequest(BaseModel):
    type: str  # 'chat', 'artefact', 'asset'
    # Node fields
    position_x: float
    position_y: float
    width: float
    height: float
    title: str
    # Content fields (optional, depending on type)
    model_used: str | None = None  # for chat
    artefact_type: str | None = None  # for artefact
    current_data: dict | None = None  # for artefact
    asset_type: str | None = None  # for asset
    source: str | None = None  # for asset


class NodeContentCreateResponse(BaseModel):
    node: NodeResponse
    content: dict | None  # ArtefactResponse, AssetResponse, or ChatSessionResponse


# Add these helper functions at the top of the file, after imports


class NodeContentFactory:
    """Factory class to handle different node content creation strategies."""

    def __init__(self, db: Session):
        self.db = db

    def create_chat_content(self, req: NodeContentCreateRequest) -> tuple[str, dict]:
        """Create chat session content."""
        chat = ChatSession(model_used=req.model_used or "gpt-4o")
        self.db.add(chat)
        self.db.flush()
        content_id = str(chat.id)
        content = {"id": str(chat.id), "model_used": chat.model_used}
        return content_id, content

    def create_artefact_content(
        self, req: NodeContentCreateRequest, user_id: str
    ) -> tuple[str, dict]:
        """Create artefact content."""
        artefact = Artefact(
            user_id=user_id,
            type=req.artefact_type or "table",
            current_data=req.current_data or {}
        )
        self.db.add(artefact)
        self.db.flush()
        content_id = str(artefact.id)
        content = {
            "id": str(artefact.id),
            "type": artefact.type,
            "current_data": artefact.current_data,
        }
        return content_id, content

    def create_pdf_placeholder_content(self) -> tuple[str, dict]:
        """Create placeholder content for PDF assets waiting for upload."""
        import uuid

        placeholder_content_id = str(uuid.uuid4())
        content = {
            "id": placeholder_content_id,
            "type": "pdf",
            "source": None,
            "status": "waiting_for_upload",
            "transcript": None,
            "is_placeholder": True,
        }
        return placeholder_content_id, content

    def create_website_placeholder_content(self) -> tuple[str, dict]:
        """Create placeholder content for website assets waiting for URL."""
        import uuid

        placeholder_content_id = str(uuid.uuid4())
        content = {
            "id": placeholder_content_id,
            "type": "website",
            "source": None,
            "status": "waiting_for_url",
            "extracted_text": None,
            "is_placeholder": True,
        }
        return placeholder_content_id, content

    def create_regular_asset_content(
        self, req: NodeContentCreateRequest, user_id: str
    ) -> tuple[str, dict]:
        """Create regular asset content with proper type detection."""
        # Determine asset type based on source URL if not explicitly provided
        asset_type = req.asset_type
        if not asset_type and req.source:
            if "youtube.com" in req.source or "youtu.be" in req.source:
                asset_type = AssetType.youtube
            elif "instagram.com" in req.source:
                asset_type = AssetType.instagram
            else:
                asset_type = AssetType.video

        asset = Asset(
            user_id=user_id,  # Add user association
            type=asset_type,
            source=req.source or "",
            status=AssetStatus.processing,
        )
        self.db.add(asset)
        self.db.flush()
        content_id = str(asset.id)
        content = {
            "id": str(asset.id),
            "type": asset.type,
            "source": asset.source,
            "status": asset.status,
        }
        return content_id, content


@router.post(
    "/full-create",
    response_model=NodeContentCreateResponse,
    summary="Atomically create a node and its content",
)
@limiter.limit(CREATE_RATE_LIMIT)
async def create_node_with_content(
    request: Request,
    graph_id: str,
    req: NodeContentCreateRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """Create a node with associated content using factory pattern for better maintainability.
    Free users are limited to 8 nodes per board, Pro users have unlimited nodes."""
    try:
        # Verify graph ownership first
        from app.db.models.graph import Graph
        graph = db.query(Graph).filter(
            Graph.id == graph_id,
            Graph.user_id == current_user.id
        ).first()

        if not graph:
            raise HTTPException(status_code=404, detail="Graph not found")

        # Check if user can create another node in this board
        if not UserLimitsService.can_create_node(db, current_user, graph_id):
            current_count = UserLimitsService.get_board_node_count(db, graph_id)
            limit_message = UserLimitsService.get_node_limit_message(current_user)
            raise HTTPException(
                status_code=403,
                detail={
                    "message": f"Node limit exceeded. This board currently has {current_count} node(s).",
                    "limit_info": limit_message,
                    "upgrade_required": not UserLimitsService.is_pro_user(current_user)
                }
            )

        # Initialize factory with database session
        content_factory = NodeContentFactory(db)

        # Create content based on type using factory methods
        if req.type == "chat":
            content_id, content = content_factory.create_chat_content(req)
        elif req.type == "artefact":
            content_id, content = content_factory.create_artefact_content(req, str(current_user.id))
        elif req.type == "asset":
            content_id, content = _handle_asset_creation(
                content_factory, req, str(current_user.id)
            )
        else:
            raise ValueError(f"Unsupported node type: {req.type}")

        # Create the node with the generated content
        node = Node(
            graph_id=graph_id,
            type=req.type,
            content_id=content_id,
            position_x=req.position_x,
            position_y=req.position_y,
            width=req.width,
            height=req.height,
            title=req.title,
        )
        db.add(node)
        db.commit()
        db.refresh(node)

        return NodeContentCreateResponse(node=node, content=content)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create node with content: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create node with content: {e!s}"
        )


def _handle_asset_creation(
    factory: NodeContentFactory, req: NodeContentCreateRequest, user_id: str
) -> tuple[str, dict]:
    """Handle asset creation logic with proper branching."""
    # Handle PDF placeholders
    if req.asset_type == "pdf" and req.source == "example.pdf":
        return factory.create_pdf_placeholder_content()

    # Handle website placeholders
    elif req.asset_type == "website" and (
        not req.source or req.source == "https://www.google.com"
    ):
        return factory.create_website_placeholder_content()

    # Handle regular assets
    else:
        return factory.create_regular_asset_content(req, user_id)


# --- Atomic Node+Content Deletion ---
class NodeContentDeleteResponse(BaseModel):
    message: str
    node_id: str
    content_id: str | None


@router.delete(
    "/{node_id}/full-delete",
    response_model=NodeContentDeleteResponse,
    summary="Atomically delete a node and its content",
)
def delete_node_and_content(
    graph_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    try:
        node = (
            db.query(Node).filter(Node.id == node_id, Node.graph_id == graph_id).first()
        )
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        content_id = node.content_id
        node_type = node.type
        db.delete(node)
        # Delete content
        if node_type == "chat":
            chat = (
                db.query(ChatSession).filter(ChatSession.id == str(content_id)).first()
            )
            if chat:
                db.delete(chat)
        elif node_type == "artefact":
            artefact = db.query(Artefact).filter(Artefact.id == str(content_id)).first()
            if artefact:
                db.delete(artefact)
        elif node_type == "asset":
            asset = db.query(Asset).filter(Asset.id == str(content_id)).first()
            if asset:
                db.delete(asset)
        db.commit()
        return NodeContentDeleteResponse(
            message="Node and content deleted",
            node_id=str(node_id),
            content_id=str(content_id) if content_id is not None else None,
        )
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete node and content: {e!s}"
        ) from e


@router.put(
    "/{node_id}",
    response_model=NodeResponse,
    summary="Update a node's position, size, or title",
)
def update_node(
    graph_id: str,
    node_id: str,
    node: NodeUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update node position, size, or title. Requires Clerk authentication.
    """
    db_node = (
        db.query(Node).filter(Node.id == node_id, Node.graph_id == graph_id).first()
    )
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    for k, v in node.dict(exclude_unset=True).items():
        setattr(db_node, k, v)
    db.commit()
    db.refresh(db_node)
    db_node.id = str(db_node.id)
    if db_node.content_id:
        db_node.content_id = str(db_node.content_id)
    return db_node


@router.delete("/{node_id}", summary="Delete a node from the graph")
def delete_node(
    graph_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Delete a node and its edges from the workspace graph. Requires Clerk authentication.
    """
    db_node = (
        db.query(Node).filter(Node.id == node_id, Node.graph_id == graph_id).first()
    )
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    db.delete(db_node)
    db.commit()
    return {"message": "Node deleted"}


@router.get("/{node_id}/content", summary="Get scraped content for a website node")
async def get_website_content(
    graph_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get the scraped content for a website node.
    Returns the markdown content, metadata, and scraping status.
    """
    try:
        # Convert string IDs to UUID objects for database queries
        from uuid import UUID

        try:
            node_uuid = UUID(node_id)
            graph_uuid = UUID(graph_id)
        except ValueError as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {e!s}"
            ) from None

        # Find the node
        node = (
            db.query(Node)
            .filter(
                Node.id == node_uuid, Node.graph_id == graph_uuid, Node.type == "asset"
            )
            .first()
        )

        if not node:
            raise HTTPException(status_code=404, detail="Node not found")

        # Find the associated asset
        try:
            # Handle content_id which might already be a UUID object or a string
            if isinstance(node.content_id, str):
                content_uuid = UUID(node.content_id)
            else:
                # content_id is already a UUID object
                content_uuid = node.content_id

            asset = (
                db.query(Asset)
                .filter(Asset.id == content_uuid, Asset.type == AssetType.website)
                .first()
            )
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid content ID format: {e!s}"
            ) from e

        if not asset:
            raise HTTPException(status_code=400, detail="Node is not a website asset")

        # Parse metadata if available
        metadata = {}
        if asset.processing_metadata:
            try:
                # Handle both string (correct) and dict (incorrect legacy) formats
                if isinstance(asset.processing_metadata, str):
                    metadata = json.loads(asset.processing_metadata)
                elif isinstance(asset.processing_metadata, dict):
                    logger.warning(f"Found dict processing_metadata for asset {asset.id}, using directly")
                    metadata = asset.processing_metadata
                else:
                    logger.warning(f"Unknown processing_metadata type for asset {asset.id}: {type(asset.processing_metadata)}")
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    f"Failed to parse processing_metadata for asset {asset.id}: {e}"
                )

        return {
            "success": True,
            "source_url": asset.source,
            "status": asset.status,
            "title": metadata.get("title", ""),
            "description": metadata.get("description", ""),
            "content": asset.extracted_text or "",
            "summary": asset.summary or "",
            "metadata": metadata,
            "content_length": len(asset.extracted_text or ""),
            "last_scraped": metadata.get("scrape_timestamp"),
        }

    except Exception as e:
        logger.error(f"Error getting website content: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get content: {e!s}"
        ) from e


@router.post(
    "/{node_id}/set-website-url",
    summary="Set URL for a website placeholder node and start scraping",
)
async def set_website_url(
    graph_id: str,
    node_id: str,
    url: str = Form(...),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Convert a website placeholder node to a real asset by setting the URL and starting scraping.
    Similar to create-from-placeholder for PDFs, but for website URLs.
    """
    logger.info(
        f"set_website_url called with graph_id={graph_id}, node_id={node_id}, url={url}"
    )

    try:
        # Convert string IDs to UUID objects for database queries
        from uuid import UUID

        try:
            node_uuid = UUID(node_id)
            graph_uuid = UUID(graph_id)
            logger.info(
                f"UUID conversion successful: node_uuid={node_uuid}, graph_uuid={graph_uuid}"
            )
        except ValueError as e:
            logger.error(f"UUID conversion failed: {e!s}")
            raise HTTPException(
                status_code=400, detail=f"Invalid UUID format: {e!s}"
            ) from e

        # Find the node
        logger.info(f"Searching for node with id={node_uuid} and graph_id={graph_uuid}")
        node = (
            db.query(Node)
            .filter(
                Node.id == node_uuid, Node.graph_id == graph_uuid, Node.type == "asset"
            )
            .first()
        )

        if not node:
            logger.error(f"Node not found: node_id={node_id}, graph_id={graph_id}")
            raise HTTPException(status_code=404, detail="Node not found")

        logger.info(f"Found node: {node.id}, content_id={node.content_id!s}")

        # Check if this node has an existing asset
        existing_asset = None
        try:
            content_uuid = UUID(str(node.content_id))  # Ensure string conversion
            existing_asset = db.query(Asset).filter(Asset.id == content_uuid).first()
        except ValueError:
            # content_id is not a valid UUID, this is expected for placeholder nodes
            logger.info(
                f"Node has placeholder content_id (not UUID): {node.content_id!s}"
            )

        # Validate URL format
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # If existing asset exists, update it with new URL and re-scrape
        if existing_asset:
            logger.info(f"Updating existing asset {existing_asset.id} with new URL: {url}")
            existing_asset.source = url
            existing_asset.status = AssetStatus.processing
            existing_asset.extracted_text = None  # Clear previous content
            existing_asset.summary = None
            db.commit()
            target_asset = existing_asset
        else:
            # Create new asset for placeholder node
            logger.info(f"Creating new asset for placeholder node {node_id}")
            target_asset = Asset(
                user_id=current_user.id,
                type=AssetType.website,
                source=url,
                status=AssetStatus.processing,
            )
            db.add(target_asset)
            db.flush()  # Get the asset ID
            
            # Update the node to point to the real Asset
            node.content_id = str(target_asset.id)
            db.commit()

        logger.info(
            f"Asset {target_asset.id!s} ready for scraping with URL {url}"
        )

        # Start scraping the website
        try:
            scrape_result = await firecrawl_service.scrape_website(url)

            if scrape_result and scrape_result.get("success"):
                # Update asset with scraped content
                target_asset.extracted_text = scrape_result.get("markdown", "")
                target_asset.summary = scrape_result.get("description", "")
                target_asset.processing_metadata = json.dumps(
                    {
                        "title": scrape_result.get("title", ""),
                        "description": scrape_result.get("description", ""),
                        "language": scrape_result.get("language", "en"),
                        "keywords": scrape_result.get("keywords", ""),
                        "firecrawl_metadata": scrape_result.get("metadata", {}),
                        "scrape_timestamp": str(datetime.utcnow()),
                        "content_length": len(scrape_result.get("markdown", "")),
                        "initial_scrape": not existing_asset,
                        "asset_id": str(target_asset.id),
                    }
                )
                target_asset.status = AssetStatus.completed
                db.commit()

                return {
                    "success": True,
                    "message": "Website URL set and content scraped successfully",
                    "asset_id": str(target_asset.id),
                    "title": scrape_result.get("title", ""),
                    "content_length": len(scrape_result.get("markdown", "")),
                    "status": str(target_asset.status.value),
                    "url": url,
                }
            else:
                # Scraping failed, but asset is still created/updated
                error_msg = (
                    scrape_result.get("error", "Unknown scraping error")
                    if scrape_result
                    else "No response from scraping service"
                )
                target_asset.processing_metadata = json.dumps(
                    {
                        "error": error_msg,
                        "scrape_timestamp": str(datetime.utcnow()),
                        "initial_scrape": not existing_asset,
                        "asset_id": str(target_asset.id),
                    }
                )
                target_asset.status = AssetStatus.failed
                db.commit()

                return {
                    "success": False,
                    "message": f"Website URL set but scraping failed: {error_msg}",
                    "asset_id": str(target_asset.id),
                    "status": str(target_asset.status.value),
                    "url": url,
                    "error": error_msg,
                }

        except Exception as scrape_error:
            # Scraping failed, but asset is still created/updated
            logger.error(f"Failed to scrape website {url}: {scrape_error!s}")
            target_asset.processing_metadata = json.dumps(
                {
                    "error": f"Scraping exception: {scrape_error!s}",
                    "scrape_timestamp": str(datetime.utcnow()),
                    "initial_scrape": not existing_asset,
                    "asset_id": str(target_asset.id),
                }
            )
            target_asset.status = AssetStatus.failed
            db.commit()

            return {
                "success": False,
                "message": f"Website URL set but scraping failed: {scrape_error!s}",
                "asset_id": str(target_asset.id),
                "status": str(target_asset.status.value),
                "url": url,
                "error": str(scrape_error),
            }

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error setting website URL: {e!s}")
        raise HTTPException(status_code=500, detail="Database error occurred") from e
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error setting website URL: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to set website URL: {e!s}"
        ) from e
