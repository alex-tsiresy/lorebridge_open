from langchain_core.tools import Tool
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.asset import Asset, AssetStatus, AssetType
from app.db.models.edge import Edge
from app.db.models.node import Node

# Import existing tool classes
from app.services.rag_services.pdf_qa_tool import PDFQuestionTool


class DynamicToolFactory:
    """Factory for creating tools based on connected nodes."""

    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    def create_tools_for_chat(self, chat_session_id: str) -> list[Tool]:
        """
        Create tools for a chat session based on connected nodes.

        Currently handles PDF tools. Website nodes send their content as context without tools.
        """
        try:
            tools = []

            # Find the chat node for this session
            chat_node = (
                self.db.query(Node)
                .filter(Node.content_id == chat_session_id, Node.type == "chat")
                .first()
            )

            if not chat_node:
                logger.info(f"No chat node found for session {chat_session_id}")
                return []

            # Find all edges that connect to this chat node
            incoming_edges = (
                self.db.query(Edge).filter(Edge.target_node_id == chat_node.id).all()
            )

            for edge in incoming_edges:
                # Get the source node
                source_node = (
                    self.db.query(Node).filter(Node.id == edge.source_node_id).first()
                )

                if not source_node:
                    continue

                # Create tools only for PDF asset nodes
                # Get the asset associated with this node
                asset = self.db.query(Asset).filter(Asset.id == source_node.content_id).first()
                
                # Check if the asset exists and is a PDF
                if asset and asset.type == AssetType.pdf:
                    pdf_tools = self._create_pdf_tools(source_node)
                    tools.extend(pdf_tools)

            logger.info(
                f"Created {len(tools)} PDF tools for chat session {chat_session_id}"
            )
            return tools

        except Exception as e:
            logger.error(f"Error creating tools for chat {chat_session_id}: {e!s}")
            return []

    def _create_pdf_tools(self, node: Node) -> list[Tool]:
        """Create PDF Q&A tools for PDF asset nodes only."""
        tools = []

        try:
            asset = self.db.query(Asset).filter(Asset.id == node.content_id).first()
            if not asset or asset.status != AssetStatus.completed:
                return tools

            # Only create tools for PDF assets with extracted text
            if asset.type == AssetType.pdf and asset.extracted_text:
                asset_title = (
                    asset.source.split("/")[-1] if asset.source else "Unknown PDF"
                )

                pdf_tool = PDFQuestionTool(
                    asset_id=str(asset.id),
                    user_id=self.user_id,
                    db=self.db,
                    pdf_title=asset_title,
                )
                # Use async tool for better performance
                tools.append(pdf_tool.to_async_langchain_tool())
                logger.info(f"Created async PDF tool for asset {asset.id}")

        except Exception as e:
            logger.error(f"Error creating PDF tools for node {node.id}: {e!s}")

        return tools


# Convenience function to maintain backward compatibility with existing code
def create_dynamic_tools_for_chat(
    chat_session_id: str, db: Session, user_id: str
) -> list[Tool]:
    """
    Main function to create tools for a chat session.
    This replaces create_pdf_tools_for_chat with a more extensible architecture.
    """
    factory = DynamicToolFactory(db, user_id)
    return factory.create_tools_for_chat(chat_session_id)
