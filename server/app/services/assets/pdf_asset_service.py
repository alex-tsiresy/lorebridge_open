from typing import Any

from sqlalchemy.orm import Session

from app.db.models.asset import Asset, AssetStatus, AssetType, DocumentType
from app.services.rag_services.file_storage_service import file_storage_service
from app.services.rag_services.pdf_processing_service import PDFProcessingService
from app.services.rag_services.pdf_summary_service import PDFSummaryService

from .base_asset_service import BaseAssetService


class PDFAssetService(BaseAssetService):
    """Specialized service for PDF asset processing."""

    def __init__(self):
        super().__init__()
        self.pdf_processor = PDFProcessingService()
        self.summary_service = PDFSummaryService()

    async def process_asset(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process PDF asset with full RAG pipeline."""
        try:
            self.log_processing_start(asset)

            # Step 1: Resolve file path to absolute path
            if not asset.file_path:
                raise Exception("No file path available for PDF asset")

            absolute_file_path = await file_storage_service.get_file_path(asset.file_path)
            
            if not absolute_file_path:
                raise Exception(f"File not found in storage: {asset.file_path}")

            # Check if file exists on filesystem using async operations
            import asyncio
            if not await asyncio.to_thread(absolute_file_path.exists):
                raise Exception(f"File does not exist on filesystem: {absolute_file_path}")

            # Step 2: Basic PDF processing with absolute path
            extracted_text, token_count, document_type = await self.pdf_processor.process_pdf(
                str(absolute_file_path)
            )

            # Step 3: Update asset with basic info
            asset.extracted_text = extracted_text
            asset.token_count = token_count
            asset.document_type = document_type

            # Step 4: Handle short vs long documents
            if document_type == DocumentType.short:
                return await self._process_short_document(asset, db)
            else:
                return await self._process_long_document(asset, db)

        except Exception as e:
            self.log_processing_error(asset, e)
            await self.update_status_async(asset, AssetStatus.failed, db)
            raise

    async def _process_short_document(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process short documents with summary generation."""
        try:
            # Generate summary without blocking the event loop
            summary = await self.summary_service.generate_summary_async(asset)
            asset.summary = summary

            # Mark as completed
            await self.update_status_async(asset, AssetStatus.completed, db)

            result = {
                "success": True,
                "asset_id": str(asset.id),
                "method": "short_document_processing",
                "token_count": asset.token_count,
                "document_type": asset.document_type.value,
            }

            self.log_processing_success(asset, result)
            return result

        except Exception as e:
            self.log_processing_error(asset, e)
            await self.update_status_async(asset, AssetStatus.failed, db)
            raise

    async def _process_long_document(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process long documents with RAG pipeline."""
        try:
            # Trigger RAG processing
            rag_result = await self.pdf_processor.process_long_pdf(asset, str(asset.user_id), db)

            # Generate RAG-based summary without blocking
            summary = await self.summary_service.generate_summary_async(asset)
            asset.summary = summary

            # Mark as completed
            await self.update_status_async(asset, AssetStatus.completed, db)

            result = {
                "success": True,
                "asset_id": str(asset.id),
                "method": "rag_processing",
                "token_count": asset.token_count,
                "document_type": asset.document_type.value,
                "collection_id": rag_result.get("collection_id"),
            }

            self.log_processing_success(asset, result)
            return result

        except Exception as e:
            self.log_processing_error(asset, e)
            await self.update_status_async(asset, AssetStatus.failed, db)
            raise

    def validate_asset(self, asset: Asset) -> bool:
        """Validate PDF asset before processing."""
        return (
            asset.type == AssetType.pdf
            and asset.file_path is not None
            and asset.status == AssetStatus.processing
        )
