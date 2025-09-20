import uuid
from enum import Enum as PyEnum

from sqlalchemy import JSON, Column, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base  # Use the shared Base


class AssetStatus(PyEnum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class AssetType(PyEnum):
    video = "video"
    pdf = "pdf"
    audio = "audio"
    website = "website"  # Added for website nodes
    youtube = "youtube"  # Platform-specific
    instagram = "instagram"  # Platform-specific
    graph = "graph"  # For graph nodes


class DocumentType(PyEnum):
    short = "short"  # <= 15k tokens
    long = "long"  # > 15k tokens


class Asset(Base):
    __tablename__ = "asset"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )  # NEW: User association
    type = Column(
        Enum(AssetType), nullable=False, comment="Type of asset: video, pdf, audio"
    )
    source = Column(
        String, nullable=False, comment="URL or filename of the asset source"
    )
    status = Column(
        Enum(AssetStatus),
        nullable=False,
        default=AssetStatus.processing,
        comment="Processing status",
    )
    transcript = Column(Text, nullable=True, comment="Extracted transcript text")
    # New columns for PDF AI processing
    extracted_text = Column(
        Text, nullable=True, comment="Full extracted text content from PDF"
    )
    token_count = Column(
        Integer, nullable=True, comment="Number of tokens in the document"
    )
    document_type = Column(
        Enum(DocumentType),
        nullable=True,
        comment="Classification: short (<=15k tokens) or long (>15k tokens)",
    )
    summary = Column(
        Text, nullable=True, comment="AI-generated summary of the document"
    )
    # File storage path for uploaded files
    file_path = Column(
        String,
        nullable=True,
        comment="Relative path to stored file in the storage directory",
    )
    # Vector database fields for RAG functionality
    vector_db_collection_id = Column(
        String, nullable=True, comment="ChromaDB collection ID for this document"
    )
    chunk_count = Column(
        Integer,
        nullable=True,
        comment="Number of text chunks created for vectorization",
    )
    processing_metadata = Column(
        JSON, nullable=True, comment="Metadata about chunking and vectorization process"
    )
