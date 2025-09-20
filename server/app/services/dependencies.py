from functools import lru_cache

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.services.ai.llm_input_preparation_service import LLMInputPreparationService
from app.services.ai.paraphrasing_service import ParaphrasingService
from app.services.export.md_export_service import MarkdownExportService
from app.services.export.mermaid_export_service import MermaidExportService
from app.services.infrastructure.edge_service import EdgeService
from app.services.processing.context_transfer_service import ContextTransferService
from app.services.processing.stream_processing_service import StreamProcessingService
from app.services.session.session_validation_service import SessionValidationService


@lru_cache
def get_paraphrasing_service() -> ParaphrasingService:
    """Get a configured ParaphrasingService instance."""
    return ParaphrasingService(llm_provider="openai", api_key=settings.OPENAI_API_KEY)


@lru_cache
def get_context_transfer_service() -> ContextTransferService:
    """Get a configured ContextTransferService instance."""
    paraphrasing_service = get_paraphrasing_service()
    return ContextTransferService(paraphrasing_service)


@lru_cache
def get_edge_service() -> EdgeService:
    """Get a configured EdgeService instance."""
    context_transfer_service = get_context_transfer_service()
    return EdgeService(context_transfer_service)


@lru_cache
def get_stream_processing_service() -> StreamProcessingService:
    """Get a configured StreamProcessingService instance."""
    return StreamProcessingService()


@lru_cache
def get_session_validation_service(db: Session = None) -> SessionValidationService:
    """Get a configured SessionValidationService instance."""
    if db is None:
        db = next(get_db())
    return SessionValidationService(db)


@lru_cache
def get_llm_input_preparation_service() -> LLMInputPreparationService:
    """Get a configured LLMInputPreparationService instance."""
    return LLMInputPreparationService()


def get_markdown_export_service(
    db: Session = None,
) -> MarkdownExportService:
    """Get a configured MarkdownExportService instance."""
    if db is None:
        db = next(get_db())

    session_validator = get_session_validation_service(db)
    input_preparer = get_llm_input_preparation_service()
    stream_processor = get_stream_processing_service()

    return MarkdownExportService(
        db=db,
        session_validator=session_validator,
        input_preparer=input_preparer,
        stream_processor=stream_processor,
    )


def get_mermaid_export_service(
    db: Session = None,
) -> MermaidExportService:
    """Get a configured MermaidExportService instance."""
    if db is None:
        db = next(get_db())

    session_validator = get_session_validation_service(db)
    input_preparer = get_llm_input_preparation_service()
    stream_processor = get_stream_processing_service()

    return MermaidExportService(
        db=db,
        session_validator=session_validator,
        input_preparer=input_preparer,
        stream_processor=stream_processor,
    )
