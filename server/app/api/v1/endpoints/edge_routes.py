from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limiter import limiter, CREATE_RATE_LIMIT, READ_RATE_LIMIT, API_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser
from app.db.models.chat_message import ChatMessage
from app.db.models.edge import Edge
from app.db.models.node import Node
from app.schemas.common import (
    EdgeCreate,
    EdgeResponse,
    EdgeUpdate,
    EdgeWithContextsResponse,
)
from app.services.dependencies import get_edge_service
from app.services.infrastructure.edge_service import EdgeService

router = APIRouter(prefix="/graphs/{graph_id}/edges", tags=["Edge"])


@router.get("/", response_model=list[EdgeResponse], summary="List all edges in a graph")
@router.get("", response_model=list[EdgeResponse], summary="List all edges in a graph")
@limiter.limit(READ_RATE_LIMIT)
def list_edges(
    request: Request,
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    List all edges in a workspace graph. Requires Clerk authentication.
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
    
    edges = db.query(Edge).filter(Edge.graph_id == graph_id).all()
    return edges


@router.post(
    "/", response_model=EdgeWithContextsResponse, summary="Create a new edge in a graph"
)
@router.post(
    "", response_model=EdgeWithContextsResponse, summary="Create a new edge in a graph"
)
def create_edge(
    graph_id: str,
    edge: EdgeCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
    edge_service: EdgeService = Depends(get_edge_service),
):
    """
    Create a new edge (context transfer) in the workspace graph. Requires Clerk authentication.
    """
    try:
        return edge_service.create_edge_with_context(graph_id, edge, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from None
    except Exception as e:
        logger.error(f"Failed to create edge: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.delete("/{edge_id}", summary="Delete an edge from the graph")
def delete_edge(
    graph_id: str,
    edge_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Delete an edge from the workspace graph. Requires Clerk authentication.
    """
    logger.info(f"Attempting to delete edge: edge_id={edge_id}, graph_id={graph_id}")
    db_edge = (
        db.query(Edge).filter(Edge.id == edge_id, Edge.graph_id == graph_id).first()
    )
    if not db_edge:
        logger.warning(
            f"Edge not found for deletion: edge_id={edge_id}, graph_id={graph_id}"
        )
        raise HTTPException(status_code=404, detail="Edge not found")
    # Capture source node before deletion for cleanup logic
    source_node_id = db_edge.source_node_id
    # Identify if source is a chat node (only then we track context origin)
    source_node = db.query(Node).filter(Node.id == source_node_id).first()

    db.delete(db_edge)
    db.commit()

    # Perform context cleanup only if source was a chat node
    if source_node and source_node.type == "chat":
        source_chat_session_id = source_node.content_id

        # Build adjacency list of remaining edges in the same graph
        edges_remaining = db.query(Edge).filter(Edge.graph_id == graph_id).all()
        adjacency = defaultdict(list)
        for e in edges_remaining:
            adjacency[str(e.source_node_id)].append(str(e.target_node_id))

        # BFS to find reachable nodes from the source node
        reachable_nodes = set()
        queue = deque([str(source_node_id)])
        while queue:
            current = queue.popleft()
            for tgt in adjacency.get(current, []):
                if tgt not in reachable_nodes:
                    reachable_nodes.add(tgt)
                    queue.append(tgt)

        # Collect chat session IDs of reachable chat nodes
        reachable_chat_session_ids = set()
        if reachable_nodes:
            chat_nodes = (
                db.query(Node)
                .filter(Node.id.in_(list(reachable_nodes)), Node.type == "chat")
                .all()
            )
            reachable_chat_session_ids = {str(n.content_id) for n in chat_nodes}

        # Delete context messages originating from this source chat that are no longer reachable
        delete_q = db.query(ChatMessage).filter(
            ChatMessage.source_chat_session_id == source_chat_session_id,
            ~ChatMessage.chat_session_id.in_(reachable_chat_session_ids),
        )
        deleted_count = delete_q.delete(synchronize_session=False)
        if deleted_count:
            logger.info(
                f"Deleted {deleted_count} unreachable context messages for source chat {source_chat_session_id}"
            )
        db.commit()

    logger.info(f"Edge deleted: edge_id={edge_id}, graph_id={graph_id}")
    return {"message": "Edge deleted"}


@router.get(
    "/{edge_id}", response_model=EdgeResponse, summary="Get a single edge by ID"
)
def get_edge(
    graph_id: str,
    edge_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Retrieve a single edge by its ID. Requires Clerk authentication.
    """
    db_edge = (
        db.query(Edge).filter(Edge.id == edge_id, Edge.graph_id == graph_id).first()
    )
    if not db_edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return db_edge


@router.put("/{edge_id}", response_model=EdgeResponse, summary="Update an edge by ID")
def update_edge(
    graph_id: str,
    edge_id: str,
    edge: EdgeUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    """
    Update an edge's properties. Requires Clerk authentication.
    """
    db_edge = (
        db.query(Edge).filter(Edge.id == edge_id, Edge.graph_id == graph_id).first()
    )
    if not db_edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    for k, v in edge.dict(exclude_unset=True).items():
        setattr(db_edge, k, v)
    db.commit()
    db.refresh(db_edge)
    return db_edge
