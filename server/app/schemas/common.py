from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import UUID4, BaseModel


# --- Graph Schemas ---
class GraphCreate(BaseModel):
    name: str
    emoji: str | None = None
    description: str | None = None
    colors: str | None = None  # Store the extracted color from emoji


class GraphUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None
    description: str | None = None
    colors: str | None = None  # Store the extracted color from emoji


# --- Node Schemas ---
class NodeType(str, Enum):
    chat = "chat"
    artefact = "artefact"
    asset = "asset"


class NodeCreate(BaseModel):
    type: NodeType
    content_id: UUID4 | None
    position_x: float
    position_y: float
    width: float
    height: float
    title: str


class NodeUpdate(BaseModel):
    position_x: float | None = None
    position_y: float | None = None
    width: float | None = None
    height: float | None = None
    title: str | None = None


# --- Edge Schemas ---
class EdgeType(str, Enum):
    derived_from = "DERIVED_FROM"


class EdgeCreate(BaseModel):
    source_node_id: UUID4
    target_node_id: UUID4
    type: EdgeType = EdgeType.derived_from
    source_handle: str | None = None
    target_handle: str | None = None


class EdgeUpdate(BaseModel):
    source_node_id: UUID4 | None = None
    target_node_id: UUID4 | None = None
    type: EdgeType | None = None
    source_handle: str | None = None
    target_handle: str | None = None


# --- Asset Schemas ---
class AssetType(str, Enum):
    video = "video"
    pdf = "pdf"
    audio = "audio"
    youtube = "youtube"
    instagram = "instagram"
    website = "website"


class AssetStatus(str, Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class DocumentType(str, Enum):
    short = "short"  # <= 15k tokens
    long = "long"  # > 15k tokens


class AssetCreate(BaseModel):
    type: AssetType
    source: str


class AssetUpdate(BaseModel):
    status: AssetStatus | None
    transcript: str | None
    extracted_text: str | None
    token_count: int | None
    document_type: DocumentType | None
    summary: str | None


# --- Artefact Schemas ---
class ArtefactType(str, Enum):
    table = "table"
    graph = "graph"
    document = "document"


class ArtefactUpdate(BaseModel):
    current_data: Any | None
    type: ArtefactType | None
    # Optional processing metadata fields
    processing_output_type: str | None = None
    processing_options: Any | None = None
    processing_primary_option_id: str | None = None
    selected_processing_option: Any | None = None


# --- Chat Schemas ---
class ChatSessionCreate(BaseModel):
    model_used: str


class ChatMessageCreate(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str


# --- Response Schemas (for FastAPI response_model) ---
class GraphResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    emoji: str | None = None
    description: str | None = None
    colors: str | None = None  # Store the extracted color from emoji
    created_at: datetime | None = None
    last_accessed_at: datetime | None = None
    is_favorite: bool | None = None

    model_config = {"from_attributes": True}


class NodeResponse(BaseModel):
    id: UUID4
    graph_id: UUID4
    type: str
    content_id: UUID4 | None  # Changed from int to UUID (str)
    position_x: float
    position_y: float
    width: float
    height: float
    title: str
    model_config = {"from_attributes": True}


class EdgeResponse(BaseModel):
    id: UUID4
    graph_id: UUID4
    source_node_id: UUID4
    target_node_id: UUID4
    type: EdgeType
    source_handle: str | None = None
    target_handle: str | None = None
    model_config = {"from_attributes": True}


class ContextMessageResponse(BaseModel):
    id: UUID
    chat_session_id: UUID
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


class EdgeWithContextResponse(EdgeResponse):
    context_message: ContextMessageResponse | None = None


# New: Return list of context messages when multiple messages are injected
class EdgeWithContextsResponse(EdgeResponse):
    context_messages: list[ContextMessageResponse] | None = None
    artefact_id: str | None = None  # For chat-to-document edge
    chat_session_id: str | None = None  # For chat-to-document edge
    placeholder: str | None = None  # For placeholder responses
    error: str | None = None  # For context transfer errors


class AssetResponse(BaseModel):
    id: UUID
    type: AssetType
    source: str
    status: AssetStatus
    transcript: str | None
    extracted_text: str | None
    token_count: int | None
    document_type: DocumentType | None
    summary: str | None
    file_path: str | None  # Add the missing file_path field
    model_config = {"from_attributes": True}


class ArtefactResponse(BaseModel):
    id: UUID  # Changed from int to UUID (str)
    type: ArtefactType
    current_data: Any | None
    processing_output_type: str | None = None
    processing_options: Any | None = None
    processing_primary_option_id: str | None = None
    selected_processing_option: Any | None = None
    descriptive_text: str | None = None
    model_config = {"from_attributes": True}


class ChatSessionResponse(BaseModel):
    id: UUID4  # Changed from int to UUID (str)
    model_used: str
    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: UUID4
    chat_session_id: UUID4  # Changed from int to UUID (str)
    role: str
    content: str
    tool_output: Any | None = None
    timestamp: datetime | None
    model_config = {"from_attributes": True}
