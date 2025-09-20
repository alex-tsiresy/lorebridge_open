import uuid

from sqlalchemy import JSON, Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class Artefact(Base):
    __tablename__ = "artefacts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )  # User association for security isolation
    type = Column(String)  # 'table', 'chart', 'document', 'graph'
    current_data = Column(JSON)  # Table data as JSON

    # Processing options persistence (for modal suggestions and selection)
    processing_output_type = Column(String, nullable=True)  # 'table' | 'markdown' | 'mermaid'
    processing_options = Column(JSON, nullable=True)  # full options JSON returned by /options
    processing_primary_option_id = Column(String, nullable=True)
    selected_processing_option = Column(JSON, nullable=True)
    
    # Descriptive text for artifact transmission between chats
    descriptive_text = Column(Text, nullable=True)
