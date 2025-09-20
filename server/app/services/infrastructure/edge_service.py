from typing import Any

from sqlalchemy.orm import Session

from app.db.models.edge import Edge
from app.db.models.node import Node
from app.schemas.common import (
    ContextMessageResponse,
    EdgeCreate,
    EdgeWithContextsResponse,
)
from app.services.processing.context_transfer_service import ContextTransferService


class EdgeService:
    """Service for handling edge operations and business logic."""

    def __init__(self, context_transfer_service: ContextTransferService):
        self.context_transfer_service = context_transfer_service

    def create_edge_with_context(
        self, graph_id: str, edge_data: EdgeCreate, db: Session
    ) -> EdgeWithContextsResponse:
        """
        Create an edge and handle context transfer based on node types.

        Args:
            graph_id: The graph ID where the edge belongs
            edge_data: Edge creation data
            db: Database session

        Returns:
            EdgeWithContextsResponse with created edge and context messages
        """
        # Step 1: Create the basic edge
        edge = self._create_basic_edge(graph_id, edge_data, db)

        # Step 2: Get source and target nodes
        source_node, target_node = self._get_nodes(edge_data, db)

        # Step 3: Handle context transfer based on node types
        context_result = self.context_transfer_service.handle_context_transfer(
            source_node, target_node, edge, db
        )

        # Step 4: Build and return response
        return self._build_response(edge, context_result)

    def _create_basic_edge(
        self, graph_id: str, edge_data: EdgeCreate, db: Session
    ) -> Edge:
        """Create and persist the basic edge entity."""
        edge = Edge(**edge_data.dict(), graph_id=graph_id)
        db.add(edge)
        db.commit()
        db.refresh(edge)
        return edge

    def _get_nodes(self, edge_data: EdgeCreate, db: Session) -> tuple[Node, Node]:
        """Retrieve and validate source and target nodes."""
        source_node = db.query(Node).filter(Node.id == edge_data.source_node_id).first()
        target_node = db.query(Node).filter(Node.id == edge_data.target_node_id).first()

        if not source_node or not target_node:
            raise ValueError("Source or target node not found")

        return source_node, target_node

    def _build_response(
        self, edge: Edge, context_result: dict[str, Any]
    ) -> EdgeWithContextsResponse:
        """Build the final response with edge and context data."""
        response = EdgeWithContextsResponse.from_orm(edge)

        # Add context messages if any were created
        if context_result.get("context_messages"):
            response.context_messages = [
                ContextMessageResponse.model_validate(cm)
                for cm in context_result["context_messages"]
            ]

        # Add error message if context transfer failed
        if context_result.get("error"):
            response.error = context_result["error"]

        # Add special response fields for different edge types
        if context_result.get("chat_session_id"):
            response.chat_session_id = context_result["chat_session_id"]

        if context_result.get("placeholder"):
            response.placeholder = context_result["placeholder"]

        return response
