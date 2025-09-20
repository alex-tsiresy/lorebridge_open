from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.rate_limiter import (
    CREATE_RATE_LIMIT,
    READ_RATE_LIMIT,
    limiter,
)
from app.db.database import get_db
from app.db.models.artefact import Artefact
from app.db.models.asset import Asset
from app.db.models.chat_message import ChatMessage
from app.db.models.chat_session import ChatSession
from app.db.models.edge import Edge
from app.db.models.graph import Graph
from app.db.models.node import Node
from app.models.user import User as DBUser
from app.schemas.common import GraphCreate, GraphResponse, GraphUpdate
from app.services.user_limits import UserLimitsService

router = APIRouter(prefix="/graphs", tags=["Graph"])


@router.post("/", response_model=GraphResponse, summary="Create a new workspace graph")
@router.post("", response_model=GraphResponse, summary="Create a new workspace graph")
@limiter.limit(CREATE_RATE_LIMIT)
async def create_graph(
    request: Request,
    graph: GraphCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a new workspace (graph) for the user. Requires authentication.
    Free users are limited to 1 board, Pro users have unlimited boards.
    """
    # Check if user can create another board
    if not UserLimitsService.can_create_board(db, current_user):
        current_count = UserLimitsService.get_user_board_count(db, str(current_user.id))
        limit_message = UserLimitsService.get_board_limit_message(current_user)
        raise HTTPException(
            status_code=403,
            detail={
                "message": f"Board limit exceeded. You currently have {current_count} board(s).",
                "limit_info": limit_message,
                "upgrade_required": not UserLimitsService.is_pro_user(current_user)
            }
        )

    db_graph = Graph(
        user_id=current_user.id,
        name=graph.name,
        emoji=graph.emoji,
        description=graph.description,
        colors=graph.colors,  # Store the extracted color from emoji
    )
    db.add(db_graph)
    db.commit()
    db.refresh(db_graph)
    return db_graph


@router.put("/{graph_id}", response_model=GraphResponse, summary="Update a graph")
async def update_graph(
    graph_id: str,
    graph_update: GraphUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update a workspace graph. Requires authentication.
    """
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to modify this graph"
        )

    # Update only provided fields
    if graph_update.name is not None:
        graph.name = graph_update.name
    if graph_update.emoji is not None:
        graph.emoji = graph_update.emoji
    if graph_update.description is not None:
        graph.description = graph_update.description
    if graph_update.colors is not None:
        graph.colors = graph_update.colors  # Update the extracted color from emoji

    db.commit()
    db.refresh(graph)
    return graph


@router.get(
    "/", response_model=list[GraphResponse], summary="List all graphs for the user"
)
@router.get(
    "", response_model=list[GraphResponse], summary="List all graphs for the user"
)
@limiter.limit(READ_RATE_LIMIT)
async def list_graphs(
    request: Request,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth())
):
    """
    List all workspace graphs for the current user. Requires authentication.
    """
    return db.query(Graph).filter(Graph.user_id == current_user.id).all()


@router.get(
    "/recent",
    response_model=list[GraphResponse],
    summary="Get recent graphs for the user",
)
def get_recent_graphs(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get recent graphs for the current user, ordered by last_accessed_at (most recent first).
    Falls back to created_at if last_accessed_at is null.
    """
    graphs = (
        db.query(Graph)
        .filter(Graph.user_id == current_user.id)
        .order_by(Graph.last_accessed_at.desc().nullslast(), Graph.created_at.desc())
        .limit(limit)
        .all()
    )

    return graphs


@router.get(
    "/{graph_id}",
    response_model=GraphResponse,
    summary="Get a specific graph's metadata",
)
async def get_graph(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get metadata for a specific workspace graph. Requires authentication.
    """
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this graph"
        )
    return graph


@router.delete("/{graph_id}", summary="Delete a workspace graph")
def delete_graph(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Delete a workspace graph and all its nodes/edges. Requires authentication.
    """
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this graph"
        )
    db.delete(graph)
    db.commit()
    return {"message": "Graph deleted"}


@router.post("/{graph_id}/record-access", summary="Record access to a graph")
def record_graph_access(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Record that the user has accessed a graph by updating the last_accessed_at timestamp.
    """
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this graph"
        )

    graph.last_accessed_at = datetime.utcnow()
    db.commit()
    db.refresh(graph)

    return {"message": "Access recorded", "graph_id": graph_id}


@router.post(
    "/{graph_id}/toggle-favorite",
    response_model=GraphResponse,
    summary="Toggle favorite status of a graph",
)
def toggle_graph_favorite(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Toggle the favorite status of a workspace graph. Requires authentication.
    """
    graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to modify this graph"
        )

    # Toggle the favorite status
    graph.is_favorite = not graph.is_favorite if graph.is_favorite is not None else True
    db.commit()
    db.refresh(graph)

    return graph


@router.post(
    "/{graph_id}/duplicate",
    response_model=GraphResponse,
    summary="Create a deep copy of a graph",
)
def duplicate_graph(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a deep copy of a workspace graph including all nodes and edges. Requires authentication.
    The new graph will have "(Copy)" appended to the original name.
    This creates true deep copies of all content (assets, artefacts, chat sessions, and messages).
    Free users are limited to 1 board, Pro users have unlimited boards.
    """
    # Check if user can create another board
    if not UserLimitsService.can_create_board(db, current_user):
        current_count = UserLimitsService.get_user_board_count(db, str(current_user.id))
        limit_message = UserLimitsService.get_board_limit_message(current_user)
        raise HTTPException(
            status_code=403,
            detail={
                "message": f"Board limit exceeded. You currently have {current_count} board(s).",
                "limit_info": limit_message,
                "upgrade_required": not UserLimitsService.is_pro_user(current_user)
            }
        )

    # Get the original graph
    original_graph = db.query(Graph).filter(Graph.id == graph_id).first()
    if not original_graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    if original_graph.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this graph"
        )

    # Create a new graph with "(Copy)" appended to the name
    new_graph_name = f"{original_graph.name} (Copy)"
    new_graph = Graph(
        user_id=current_user.id,
        name=new_graph_name,
        emoji=original_graph.emoji,  # Copy the emoji
        description=original_graph.description,  # Copy the description
        colors=original_graph.colors,  # Copy the color
        created_at=datetime.utcnow(),
        last_accessed_at=datetime.utcnow(),
        is_favorite=False,  # Reset favorite status for the copy
    )
    db.add(new_graph)
    db.flush()  # Flush to get the new graph ID

    # Get all nodes from the original graph
    original_nodes = db.query(Node).filter(Node.graph_id == graph_id).all()

    # Create mappings for content duplication
    node_id_mapping = {}
    content_id_mapping = {}  # Map old content IDs to new content IDs

    # Duplicate all nodes and their content
    for original_node in original_nodes:
        new_content_id = None

        # Create deep copy of content based on node type
        if original_node.content_id:
            if original_node.type == "asset":
                # Duplicate asset
                original_asset = (
                    db.query(Asset).filter(Asset.id == original_node.content_id).first()
                )
                if original_asset:
                    new_asset = Asset(
                        user_id=current_user.id,  # Add user association
                        type=original_asset.type,
                        source=original_asset.source,
                        status=original_asset.status,
                        transcript=original_asset.transcript,
                        extracted_text=original_asset.extracted_text,
                        token_count=original_asset.token_count,
                        document_type=original_asset.document_type,
                        summary=original_asset.summary,
                        file_path=original_asset.file_path,
                        vector_db_collection_id=original_asset.vector_db_collection_id,
                        chunk_count=original_asset.chunk_count,
                        processing_metadata=original_asset.processing_metadata,
                    )
                    db.add(new_asset)
                    db.flush()
                    new_content_id = new_asset.id
                    content_id_mapping[original_node.content_id] = new_content_id

            elif original_node.type == "artefact":
                # Duplicate artefact
                original_artefact = (
                    db.query(Artefact)
                    .filter(Artefact.id == original_node.content_id)
                    .first()
                )
                if original_artefact:
                    new_artefact = Artefact(
                        user_id=current_user.id,  # Associate with current user
                        type=original_artefact.type,
                        current_data=original_artefact.current_data,
                        processing_output_type=original_artefact.processing_output_type,
                        processing_options=original_artefact.processing_options,
                        processing_primary_option_id=original_artefact.processing_primary_option_id,
                        selected_processing_option=original_artefact.selected_processing_option,
                        descriptive_text=original_artefact.descriptive_text,
                    )
                    db.add(new_artefact)
                    db.flush()
                    new_content_id = new_artefact.id
                    content_id_mapping[original_node.content_id] = new_content_id

            elif original_node.type == "chat":
                # Duplicate chat session
                original_chat = (
                    db.query(ChatSession)
                    .filter(ChatSession.id == original_node.content_id)
                    .first()
                )
                if original_chat:
                    new_chat = ChatSession(model_used=original_chat.model_used)
                    db.add(new_chat)
                    db.flush()
                    new_content_id = new_chat.id
                    content_id_mapping[original_node.content_id] = new_content_id

                    # Duplicate all chat messages for this session
                    original_messages = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.chat_session_id == original_node.content_id)
                        .all()
                    )
                    for original_message in original_messages:
                        new_message = ChatMessage(
                            chat_session_id=new_chat.id,
                            source_chat_session_id=original_message.source_chat_session_id,  # Keep original source reference
                            role=original_message.role,
                            content=original_message.content,
                            tool_output=original_message.tool_output,
                            timestamp=original_message.timestamp,
                        )
                        db.add(new_message)

        # Create new node with new content ID
        new_node = Node(
            graph_id=new_graph.id,
            type=original_node.type,
            content_id=new_content_id,  # Use new content ID instead of original
            position_x=original_node.position_x,
            position_y=original_node.position_y,
            width=original_node.width,
            height=original_node.height,
            title=original_node.title,
        )
        db.add(new_node)
        db.flush()  # Flush to get the new node ID
        node_id_mapping[original_node.id] = new_node.id

    # Get all edges from the original graph
    original_edges = db.query(Edge).filter(Edge.graph_id == graph_id).all()

    # Duplicate all edges with updated node references
    for original_edge in original_edges:
        # Only create the edge if both source and target nodes were successfully duplicated
        if (
            original_edge.source_node_id in node_id_mapping
            and original_edge.target_node_id in node_id_mapping
        ):
            new_edge = Edge(
                graph_id=new_graph.id,
                source_node_id=node_id_mapping[original_edge.source_node_id],
                target_node_id=node_id_mapping[original_edge.target_node_id],
                type=original_edge.type,
                source_handle=original_edge.source_handle,
                target_handle=original_edge.target_handle,
            )
            db.add(new_edge)

    # Commit all changes
    db.commit()
    db.refresh(new_graph)

    return new_graph
