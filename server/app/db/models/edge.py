import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class Edge(Base):
    __tablename__ = "edges"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id = Column(UUID(as_uuid=True), ForeignKey("graphs.id", ondelete="CASCADE"))
    source_node_id = Column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE")
    )
    target_node_id = Column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE")
    )
    type = Column(String)  # 'DERIVED_FROM'
    source_handle = Column(String, nullable=True)
    target_handle = Column(String, nullable=True)
