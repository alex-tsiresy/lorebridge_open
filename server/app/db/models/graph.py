import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Graph(Base):
    __tablename__ = "graphs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String)
    emoji = Column(String, nullable=True)
    description = Column(String, nullable=True)
    colors = Column(String, nullable=True)  # Store the extracted color from emoji
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed_at = Column(DateTime, nullable=True)
    is_favorite = Column(Boolean, nullable=True, default=False)
    # Add relationship to Node
    nodes = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
