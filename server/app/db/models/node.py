import uuid

from sqlalchemy import Column, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Node(Base):
    __tablename__ = "nodes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id = Column(UUID(as_uuid=True), ForeignKey("graphs.id", ondelete="CASCADE"))
    type = Column(String)  # 'chat', 'artefact', 'asset'
    content_id = Column(
        UUID(as_uuid=True)
    )  # FK (UUID) to ChatSession, Artefact, or Asset
    position_x = Column(Float)
    position_y = Column(Float)
    width = Column(Float)
    height = Column(Float)
    title = Column(String)
    # Add relationship to Graph
    graph = relationship("Graph", back_populates="nodes")
