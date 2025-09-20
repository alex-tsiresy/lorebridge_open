import json
import time
from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.artefact import Artefact
from app.db.models.asset import Asset, AssetStatus, AssetType, DocumentType
from app.db.models.chat_message import ChatMessage
from app.db.models.edge import Edge
from app.db.models.node import Node
from app.services.ai.paraphrasing_service import ParaphrasingService


class ContextTransferStrategy(ABC):
    """Abstract base class for context transfer strategies."""

    @abstractmethod
    def can_handle(self, source_node: Node, target_node: Node) -> bool:
        """Check if this strategy can handle the given node combination."""
        pass

    @abstractmethod
    def transfer_context(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """Execute the context transfer and return result data."""
        pass


class ChatToArtefactStrategy(ContextTransferStrategy):
    """Handle chat-to-artefact context transfer."""

    def can_handle(self, source_node: Node, target_node: Node) -> bool:
        return source_node.type == "chat" and target_node.type == "artefact"

    def transfer_context(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """Handle chat-to-artefact edge creation."""
        logger.info(
            "[ContextTransfer] Processing chat-to-artefact edge",
            {
                "source_node_id": str(source_node.id),
                "target_node_id": str(target_node.id),
                "edge_id": str(edge.id),
                "timestamp": time.time(),
            },
        )

        # Fetch the artefact to check its type
        target_artefact = (
            db.query(Artefact).filter(Artefact.id == target_node.content_id).first()
        )

        if not target_artefact:
            return {"placeholder": "Target artefact not found"}

        artefact_type = getattr(target_artefact, "type", None)

        if artefact_type == "document":
            logger.info(
                "[ContextTransfer] Creating chat-to-document edge",
                {
                    "chat_session_id": str(source_node.content_id),
                    "artefact_id": str(target_artefact.id),
                    "edge_id": str(edge.id),
                    "timestamp": time.time(),
                },
            )
            return {
                "context_messages": [],
                "chat_session_id": str(source_node.content_id),
            }

        elif artefact_type == "table":
            logger.info(
                "[ContextTransfer] Creating chat-to-table edge",
                {
                    "chat_session_id": str(source_node.content_id),
                    "artefact_id": str(target_artefact.id),
                    "edge_id": str(edge.id),
                    "timestamp": time.time(),
                },
            )
            return {
                "context_messages": [],
                "chat_session_id": str(source_node.content_id),
            }

        elif artefact_type == "graph":
            logger.info(
                "[ContextTransfer] Creating chat-to-graph edge",
                {
                    "chat_session_id": str(source_node.content_id),
                    "artefact_id": str(target_artefact.id),
                    "edge_id": str(edge.id),
                    "timestamp": time.time(),
                },
            )
            return {
                "context_messages": [],
                "chat_session_id": str(source_node.content_id),
            }

        else:
            return {"placeholder": "Edge type not implemented yet."}


class ChatToChatStrategy(ContextTransferStrategy):
    """Handle chat-to-chat context transfer with message summarization."""

    def __init__(self, paraphrasing_service: ParaphrasingService):
        self.paraphrasing_service = paraphrasing_service

    def can_handle(self, source_node: Node, target_node: Node) -> bool:
        return source_node.type == "chat" and target_node.type == "chat"

    def transfer_context(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """Handle chat-to-chat context transfer with summarization."""
        source_chat_session_id = source_node.content_id
        target_chat_session_id = target_node.content_id

        # Validate transfer to prevent circular transfers
        if not self._validate_context_transfer(source_chat_session_id, target_chat_session_id, db):
            logger.warning(f"Circular transfer prevented: {source_chat_session_id} -> {target_chat_session_id}")
            return {
                "context_messages": [],
                "error": "Circular transfer prevented"
            }

        # Get existing context to avoid duplicates
        existing_context = self._get_existing_context_contents(
            target_chat_session_id, db
        )

        # Get existing origins to prevent circular transfers
        existing_origins = self._get_existing_context_origins(
            target_chat_session_id, db
        )

        # Get source messages for summarization
        source_messages = self._get_source_messages(source_chat_session_id, db)

        # Build messages to add
        messages_to_add = self._build_context_messages(
            source_messages, existing_context, existing_origins, source_chat_session_id
        )

        # Create context messages in database
        context_messages = self._create_context_messages(
            messages_to_add, target_chat_session_id, source_chat_session_id, db
        )

        return {"context_messages": context_messages}

    def _validate_context_transfer(
        self, source_chat_session_id: str, target_chat_session_id: str, db: Session
    ) -> bool:
        """Validate that context transfer doesn't create circular references."""
        # Only prevent true circular transfers (source = target)
        if source_chat_session_id == target_chat_session_id:
            return False  # Circular transfer detected
        
        return True

    def _get_existing_context_contents(
        self, target_chat_session_id: str, db: Session
    ) -> set:
        """Get existing context message contents to avoid duplicates."""
        existing_messages = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.chat_session_id == target_chat_session_id,
                ChatMessage.role == "context",
            )
            .all()
        )
        return {msg.content for msg in existing_messages}

    def _get_existing_context_origins(
        self, target_chat_session_id: str, db: Session
    ) -> set:
        """Get existing context message origins to prevent circular transfers."""
        existing_contexts = (
            db.query(ChatMessage.source_chat_session_id)
            .filter(
                ChatMessage.chat_session_id == target_chat_session_id,
                ChatMessage.role == "context",
                ChatMessage.source_chat_session_id.isnot(None)
            )
            .all()
        )
        return {str(origin[0]) for origin in existing_contexts if origin[0]}

    def _get_source_messages(
        self, source_chat_session_id: str, db: Session
    ) -> list[ChatMessage]:
        """Retrieve source chat messages ordered by timestamp."""
        return (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_session_id == source_chat_session_id)
            .order_by(ChatMessage.timestamp)
            .all()
        )

    def _build_context_messages(
        self, source_messages: list[ChatMessage], existing_context: set, 
        existing_origins: set, source_chat_session_id: str
    ) -> list[dict]:
        """Build list of context messages including paraphrased summary with origin-based duplicate prevention."""
        messages_to_add = []

        # Separate context and chat messages
        context_messages = [
            m.content for m in source_messages if m.role == "context" and m.content
        ]
        chat_messages = [m for m in source_messages if m.role != "context"]

        # Add existing context messages (if not duplicates) - preserve their original origins
        for msg in source_messages:
            if msg.role == "context" and msg.content and msg.content not in existing_context:
                # Use the original source_chat_session_id from the context message
                original_origin = msg.source_chat_session_id if msg.source_chat_session_id else source_chat_session_id
                
                # Only add if this origin doesn't already exist in target
                if str(original_origin) not in existing_origins:
                    messages_to_add.append({
                        'content': msg.content,
                        'original_origin': original_origin
                    })
                else:
                    logger.info(f"Skipping context message with origin {original_origin} - already exists in target")

        # Create paraphrased summary of chat messages
        if chat_messages:
            text_to_summarize = " ".join(
                [f"{msg.role}: {msg.content}" for msg in chat_messages if msg.content]
            )

            if text_to_summarize.strip():
                paraphrased_text = self.paraphrasing_service.paraphrase(
                    text_to_summarize
                )
                if paraphrased_text and paraphrased_text not in existing_context:
                    # Only add if the source origin doesn't already exist in target
                    if str(source_chat_session_id) not in existing_origins:
                        messages_to_add.append({
                            'content': paraphrased_text,
                            'original_origin': source_chat_session_id
                        })
                    else:
                        logger.info(f"Skipping paraphrased summary - source origin {source_chat_session_id} already exists in target")

        return messages_to_add

    def _create_context_messages(
        self,
        messages_to_add: list[dict],
        target_chat_session_id: str,
        source_chat_session_id: str,
        db: Session,
    ) -> list[ChatMessage]:
        """Create and persist context messages in the database with original origin tracking."""
        context_messages = []

        for msg_data in messages_to_add:
            content = msg_data['content']
            original_origin = msg_data['original_origin']
            
            chat_message = ChatMessage(
                chat_session_id=target_chat_session_id,
                role="context",
                content=content,
                source_chat_session_id=original_origin,  # Use the original origin, not the immediate source
            )
            db.add(chat_message)
            context_messages.append(chat_message)

        if context_messages:
            db.commit()
            for cm in context_messages:
                db.refresh(cm)

        return context_messages


class AssetToChatStrategy(ContextTransferStrategy):
    """Handle asset-to-chat context transfer."""

    def can_handle(self, source_node: Node, target_node: Node) -> bool:
        return source_node.type == "asset" and target_node.type == "chat"

    def transfer_context(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """Handle asset-to-chat context transfer."""
        source_asset = (
            db.query(Asset).filter(Asset.id == source_node.content_id).first()
        )

        if not source_asset:
            content = "Source asset not found or has no content available."
        else:
            content = self._build_asset_context(source_asset)

        # Create context message
        context_message = self._create_single_context_message(
            content, target_node.content_id, db
        )

        return {"context_messages": [context_message] if context_message else []}

    def _build_asset_context(self, asset: Asset) -> str:
        """Build context content based on asset type and status."""
        if asset.type == AssetType.pdf:
            return self._build_pdf_context(asset)
        elif asset.type == AssetType.website:
            return self._build_website_context(asset)
        elif asset.transcript:
            return self._build_transcript_context(asset)
        else:
            return f"This edge connects to a {asset.type} asset ({asset.source}) but the content is still being processed. Please check back later."

    def _build_pdf_context(self, asset: Asset) -> str:
        """Build context for PDF assets."""
        filename = asset.source.split("/")[-1]

        if asset.status == AssetStatus.completed and asset.extracted_text:
            if asset.summary:
                return f"PDF Document: {filename}\n\nSummary:\n{asset.summary}\n\n[You now have access to a PDF Q&A tool for detailed questions about this document]"
            else:
                truncated_text = (
                    asset.extracted_text[:2000] + "..."
                    if len(asset.extracted_text) > 2000
                    else asset.extracted_text
                )
                return f"PDF Document: {filename}\n\nContent Preview:\n{truncated_text}\n\n[You now have access to a PDF Q&A tool for detailed questions about this document]"
        elif asset.status == AssetStatus.processing:
            if asset.document_type == DocumentType.long:
                return f"PDF document ({filename}) is being processed for intelligent Q&A (text extraction, chunking, and summary generation). This may take a few minutes for large documents. Please check back later."
            else:
                return f"PDF document ({filename}) is still being processed. Please check back later."
        else:
            print(f"PDF document ({filename}) is not ready for Q&A yet.")
            print(f"Asset status: {asset.status}")
            print(f"Asset document type: {asset.document_type}")
            return f"PDF document ({filename}) is not ready for Q&A yet."

    def _build_website_context(self, asset: Asset) -> str:
        """Build context for website assets."""
        if asset.status == AssetStatus.completed and asset.extracted_text:
            if asset.summary:
                return f"Website: {asset.source}\n\nSummary:\n{asset.summary}\n\n[This website content has been scraped and is available for questions]"
            else:
                truncated_text = (
                    asset.extracted_text[:2000] + "..."
                    if len(asset.extracted_text) > 2000
                    else asset.extracted_text
                )
                return f"Website: {asset.source}\n\nContent Preview:\n{truncated_text}\n\n[This website content has been scraped and is available for questions]"
        elif asset.status == AssetStatus.processing:
            return f"Website ({asset.source}) is still being scraped. Please check back later."
        else:
            return (
                f"Website ({asset.source}) scraping failed or content is not ready yet."
            )

    def _build_transcript_context(self, asset: Asset) -> str:
        """Build context for assets with transcripts."""
        asset_type_name = asset.type.value.title() if asset.type else "Asset"
        # Send the complete transcript instead of truncating
        return f"{asset_type_name}: {asset.source.split('/')[-1]}\n\nComplete Transcript:\n{asset.transcript}"

    def _create_single_context_message(
        self, content: str, target_chat_session_id: str, db: Session
    ) -> ChatMessage | None:
        """Create a single context message if it doesn't already exist."""
        # Check if this content already exists
        existing = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.chat_session_id == target_chat_session_id,
                ChatMessage.role == "context",
                ChatMessage.content == content,
            )
            .first()
        )

        if existing:
            return None

        chat_message = ChatMessage(
            chat_session_id=target_chat_session_id, role="context", content=content
        )
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
        return chat_message


class ArtefactToChatStrategy(ContextTransferStrategy):
    """Handle artefact-to-chat context transfer."""

    def can_handle(self, source_node: Node, target_node: Node) -> bool:
        return source_node.type == "artefact" and target_node.type == "chat"

    def transfer_context(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """Handle artefact-to-chat context transfer."""
        source_artefact = (
            db.query(Artefact).filter(Artefact.id == source_node.content_id).first()
        )

        if not source_artefact:
            # Artefact missing
            placeholder_message = self._create_single_context_message(
                "Source artefact not found.", target_node.content_id, db
            )
            return {"context_messages": [placeholder_message] if placeholder_message else []}

        artefact_type = getattr(source_artefact, "type", None)
        created_messages: list[ChatMessage] = []

        # Tables: inject both descriptive_text (if present) and the table content
        if artefact_type == "table":
            # 1) Descriptive text gives a natural language explanation of the table
            if getattr(source_artefact, "descriptive_text", None):
                msg = self._create_single_context_message(
                    source_artefact.descriptive_text, target_node.content_id, db
                )
                if msg:
                    created_messages.append(msg)

            # 2) Structured table content for precise data
            if source_artefact.current_data:
                try:
                    table_payload = json.dumps(source_artefact.current_data)
                except Exception:
                    # Fallback to stringification if unexpected structure
                    table_payload = str(source_artefact.current_data)
                msg = self._create_single_context_message(
                    table_payload, target_node.content_id, db
                )
                if msg:
                    created_messages.append(msg)

        # Documents: inject the full markdown content
        elif artefact_type == "document":
            markdown_content = None
            if source_artefact.current_data and isinstance(source_artefact.current_data, dict):
                markdown_content = source_artefact.current_data.get("markdown")

            if not markdown_content:
                # Fallback to dumping whatever is stored
                try:
                    markdown_content = json.dumps(source_artefact.current_data) if source_artefact.current_data else "Artefact data is not available."
                except Exception:
                    markdown_content = str(source_artefact.current_data)

            msg = self._create_single_context_message(
                markdown_content, target_node.content_id, db
            )
            if msg:
                created_messages.append(msg)

        # Graphs (Mermaid): inject descriptive_text and the raw mermaid source
        elif artefact_type == "graph":
            if getattr(source_artefact, "descriptive_text", None):
                msg = self._create_single_context_message(
                    source_artefact.descriptive_text, target_node.content_id, db
                )
                if msg:
                    created_messages.append(msg)

            mermaid_source = None
            if source_artefact.current_data and isinstance(source_artefact.current_data, dict):
                mermaid_source = source_artefact.current_data.get("mermaid")

            # If we have mermaid source, send as fenced code block; otherwise fallback to serialized data
            if mermaid_source:
                mermaid_block = f"""```mermaid\n{mermaid_source}\n```"""
                msg = self._create_single_context_message(
                    mermaid_block, target_node.content_id, db
                )
                if msg:
                    created_messages.append(msg)
            elif source_artefact.current_data:
                try:
                    serialized = json.dumps(source_artefact.current_data)
                except Exception:
                    serialized = str(source_artefact.current_data)
                msg = self._create_single_context_message(
                    serialized, target_node.content_id, db
                )
                if msg:
                    created_messages.append(msg)

        else:
            # Default behavior for other artefact types (e.g., graph): pass through stored data
            if source_artefact.current_data:
                try:
                    content = json.dumps(source_artefact.current_data)
                except Exception:
                    content = str(source_artefact.current_data)
            else:
                content = "Artefact data is not available."

            msg = self._create_single_context_message(
                content, target_node.content_id, db
            )
            if msg:
                created_messages.append(msg)

        return {"context_messages": created_messages}

    def _create_single_context_message(
        self, content: str, target_chat_session_id: str, db: Session
    ) -> ChatMessage | None:
        """Create a single context message if it doesn't already exist."""
        # Check if this content already exists
        existing = (
            db.query(ChatMessage)
            .filter(
                ChatMessage.chat_session_id == target_chat_session_id,
                ChatMessage.role == "context",
                ChatMessage.content == content,
            )
            .first()
        )

        if existing:
            return None

        chat_message = ChatMessage(
            chat_session_id=target_chat_session_id, role="context", content=content
        )
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
        return chat_message


class ContextTransferService:
    """Service for handling context transfer between different node types."""

    def __init__(self, paraphrasing_service: ParaphrasingService):
        self.strategies: list[ContextTransferStrategy] = [
            ChatToArtefactStrategy(),
            ChatToChatStrategy(paraphrasing_service),
            AssetToChatStrategy(),
            ArtefactToChatStrategy(),
        ]

    def validate_context_transfer(
        self, source_node: Node, target_node: Node, db: Session
    ) -> bool:
        """Validate that context transfer doesn't create circular references."""
        # Only validate chat-to-chat transfers for circular prevention
        if source_node.type != "chat" or target_node.type != "chat":
            return True
        
        source_session_id = source_node.content_id
        target_session_id = target_node.content_id
        
        # Only prevent true circular transfers (source = target)
        if source_session_id == target_session_id:
            logger.warning(f"Circular transfer prevented: {source_session_id} -> {target_session_id}")
            return False
        
        return True

    def handle_context_transfer(
        self, source_node: Node, target_node: Node, edge: Edge, db: Session
    ) -> dict[str, Any]:
        """
        Handle context transfer based on node types using appropriate strategy.

        Returns:
            Dict with context_messages, chat_session_id, or placeholder data
        """
        try:
            # Validate transfer first
            if not self.validate_context_transfer(source_node, target_node, db):
                return {"context_messages": [], "error": "Circular transfer prevented"}
            
            # Find appropriate strategy
            for strategy in self.strategies:
                if strategy.can_handle(source_node, target_node):
                    return strategy.transfer_context(source_node, target_node, edge, db)

            # No strategy found - no context transfer needed
            return {"context_messages": []}

        except Exception as e:
            logger.error(
                f"Failed to transfer context during edge creation: {e}", exc_info=True
            )
            db.rollback()
            return {"context_messages": []}
