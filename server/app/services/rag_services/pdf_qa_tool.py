from langchain_core.tools import Tool
from sqlalchemy.orm import Session
import asyncio
import json
from typing import Any, Dict

from app.core.logger import logger
from .pdf_qa_service import PDFQAService


class PDFQuestionTool:
    """
    A LangChain tool that provides PDF Q&A capabilities to chat agents.
    This tool is dynamically injected when a PDF node is connected to a chat node.
    """

    def __init__(self, asset_id: str, user_id: str, db: Session, pdf_title: str = None):
        self.asset_id = asset_id
        self.user_id = user_id
        self.db = db
        self.pdf_title = pdf_title or f"PDF {asset_id[:8]}"
        self.pdf_qa_service = PDFQAService()

    async def _ask_pdf_question_async(self, question: str) -> str:
        """
        Native async function that calls the PDF Q&A service.
        This eliminates the blocking asyncio.run() call.
        """
        try:
            logger.info(
                f"PDF tool (async) called for asset {self.asset_id} by user {self.user_id}: {question}"
            )

            # Direct async call - no blocking asyncio.run()
            result = await self.pdf_qa_service.answer_question_about_pdf(
                db=self.db,
                user_id=self.user_id,
                question=question,
                asset_id=self.asset_id,
            )

            if result["success"]:
                logger.info(f"PDF tool (async) successful for asset {self.asset_id}")
                
                # Return structured JSON for tool output to frontend
                tool_output = {
                    "type": "rag_result",
                    "answer": result["answer"],
                    "method": result.get("method", "unknown"),
                    "chunks_used": result.get("chunks_used", 0),
                    "context_tokens": result.get("context_tokens", 0),
                    "relevant_chunks": result.get("relevant_chunks", []),
                    "pdf_title": self.pdf_title,
                    "asset_id": self.asset_id,
                    "processing_time": result.get("processing_time", 0),
                    "success": True
                }
                
                # Return JSON string that will be parsed by the streaming service
                return json.dumps(tool_output, ensure_ascii=False)
            else:
                logger.error(
                    f"PDF tool (async) failed for asset {self.asset_id}: {result['error']}"
                )
                # Return structured error response
                error_output = {
                    "type": "rag_result",
                    "answer": f"I couldn't answer that question about the PDF. {result['error']}",
                    "method": "error",
                    "chunks_used": 0,
                    "context_tokens": 0,
                    "relevant_chunks": [],
                    "pdf_title": self.pdf_title,
                    "asset_id": self.asset_id,
                    "success": False,
                    "error": result['error']
                }
                return json.dumps(error_output, ensure_ascii=False)

        except Exception as e:
            logger.error(f"PDF tool (async) exception for asset {self.asset_id}: {e!s}")
            # Return structured exception response
            exception_output = {
                "type": "rag_result",
                "answer": f"I encountered an error while trying to answer your question about the PDF: {e!s}",
                "method": "exception",
                "chunks_used": 0,
                "context_tokens": 0,
                "relevant_chunks": [],
                "pdf_title": self.pdf_title,
                "asset_id": self.asset_id,
                "success": False,
                "error": str(e)
            }
            return json.dumps(exception_output, ensure_ascii=False)

    def _ask_pdf_question(self, question: str) -> str:
        """
        Legacy sync wrapper for backward compatibility.
        This should be replaced with direct async calls.
        """
        try:
            # Only use asyncio.run if we're not in an async context
            try:
                loop = asyncio.get_running_loop()
                # We're in an async context, this shouldn't be called
                logger.warning("Sync PDF tool called in async context - this should be avoided")
                return asyncio.run(self._ask_pdf_question_async(question))
            except RuntimeError:
                # No running loop, safe to use asyncio.run
                return asyncio.run(self._ask_pdf_question_async(question))
        except Exception as e:
            logger.error(f"PDF tool sync wrapper exception: {e!s}")
            return json.dumps({
                "type": "rag_result", 
                "answer": f"Tool execution failed: {e!s}", 
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)

    def to_langchain_tool(self) -> Tool:
        """
        Convert this PDF tool to a LangChain Tool object that can be used by agents.
        Uses the legacy sync wrapper for backward compatibility.
        """
        return Tool(
            name=f"ask_pdf_question_{self.asset_id[:8]}",
            func=self._ask_pdf_question,
            description=f"Ask questions about the PDF document '{self.pdf_title}'. "
            f"Use this tool when the user asks specific questions about the content, "
            f"details, or information within this PDF document. "
            f"The tool can handle both short and long documents intelligently. "
            f"This tool uses RAG (Retrieval-Augmented Generation) for long documents.",
        )

    def to_async_langchain_tool(self) -> Tool:
        """
        Convert this PDF tool to an async LangChain Tool object.
        This is the preferred method for native async agent execution.
        """
        return Tool(
            name=f"ask_pdf_question_{self.asset_id[:8]}",
            func=self._ask_pdf_question,  # Fallback sync method
            coroutine=self._ask_pdf_question_async,  # Primary async method
            description=f"Ask questions about the PDF document '{self.pdf_title}'. "
            f"Use this tool when the user asks specific questions about the content, "
            f"details, or information within this PDF document. "
            f"The tool can handle both short and long documents intelligently. "
            f"This tool uses RAG (Retrieval-Augmented Generation) for long documents.",
        )


def create_pdf_tools_for_chat(
    chat_session_id: str, db: Session, user_id: str
) -> list[Tool]:
    """
    Create PDF Q&A tools for a chat session based on connected PDF assets.

    This function looks for edges that connect PDF assets to the given chat session
    and creates corresponding PDF Q&A tools.

    Args:
        chat_session_id: The chat session ID to find connected PDFs for
        db: Database session
        user_id: User ID for security scoping

    Returns:
        List of LangChain Tool objects for connected PDFs
    """
    try:
        from app.db.models.asset import Asset, AssetStatus, AssetType
        from app.db.models.edge import Edge
        from app.db.models.node import Node

        # Find the chat node for this session
        chat_node = (
            db.query(Node)
            .filter(Node.content_id == chat_session_id, Node.type == "chat")
            .first()
        )

        if not chat_node:
            logger.info(f"No chat node found for session {chat_session_id}")
            return []

        # Find all edges that connect to this chat node (as target)
        incoming_edges = (
            db.query(Edge).filter(Edge.target_node_id == chat_node.id).all()
        )

        pdf_tools = []

        for edge in incoming_edges:
            # Get the source node
            source_node = db.query(Node).filter(Node.id == edge.source_node_id).first()

            if source_node and source_node.type == "asset":
                # Get the asset
                asset = (
                    db.query(Asset).filter(Asset.id == source_node.content_id).first()
                )

                if (
                    asset
                    and asset.type == AssetType.pdf
                    and asset.status == AssetStatus.completed
                    and asset.extracted_text
                ):
                    # Create PDF tool for this asset
                    pdf_tool = PDFQuestionTool(
                        asset_id=str(asset.id),
                        user_id=user_id,
                        db=db,
                        pdf_title=asset.source.split("/")[-1],  # Extract filename
                    )

                    # Use async tool for better performance
                    pdf_tools.append(pdf_tool.to_async_langchain_tool())
                    logger.info(
                        f"Created async PDF tool for asset {asset.id} in chat {chat_session_id}"
                    )

        logger.info(
            f"Created {len(pdf_tools)} PDF tools for chat session {chat_session_id}"
        )
        return pdf_tools

    except Exception as e:
        logger.error(f"Error creating PDF tools for chat {chat_session_id}: {e!s}")
        return []
