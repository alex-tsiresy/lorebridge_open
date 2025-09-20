import logging
import asyncio

import fitz  # PyMuPDF
import tiktoken
from sqlalchemy.orm import Session

from app.db.models.asset import Asset, DocumentType
from app.services.rag_services.rag_service import RAGService

logger = logging.getLogger(__name__)


class PDFProcessingService:
    """
    Service for processing PDF documents - extracting text, counting tokens, and classifying document length.

    This service handles:
    1. PDF text extraction using PyMuPDF
    2. Token counting using tiktoken
    3. Document classification (short vs long)
    4. RAG processing for long documents (Phase 3)
    """

    def __init__(self):
        # Initialize tiktoken encoder for GPT models (cl100k_base is used by GPT-4, GPT-3.5-turbo)
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.token_threshold = (
            15000  # 15k token threshold for short vs long classification
        )

        # Initialize RAG service for long document processing
        self.rag_service = RAGService()

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text content from a PDF file using PyMuPDF.

        Args:
            pdf_path: Path to the PDF file

        Returns:
            Extracted text content as a string

        Raises:
            Exception: If PDF cannot be processed
        """
        try:
            # Open the PDF document
            doc = fitz.open(pdf_path)
            extracted_text = ""

            # Iterate through all pages and extract text
            for page_num in range(len(doc)):
                page = doc[page_num]
                # Extract text from the page
                page_text = page.get_text()
                extracted_text += page_text + "\n"

            # Close the document
            doc.close()

            # Clean up the text (remove excessive whitespace)
            extracted_text = self._clean_text(extracted_text)

            logger.info(
                f"Successfully extracted text from PDF: {len(extracted_text)} characters"
            )
            return extracted_text

        except Exception as e:
            logger.error(f"Failed to extract text from PDF {pdf_path}: {e!s}")
            raise Exception(f"PDF text extraction failed: {e!s}") from e

    def count_tokens(self, text: str) -> int:
        """
        Count the number of tokens in the given text using tiktoken.

        Args:
            text: Text content to count tokens for

        Returns:
            Number of tokens in the text
        """
        try:
            # Encode the text and count tokens
            tokens = self.tokenizer.encode(text)
            token_count = len(tokens)

            logger.info(f"Token count: {token_count}")
            return token_count

        except Exception as e:
            logger.error(f"Failed to count tokens: {e!s}")
            return 0

    def classify_document_type(self, token_count: int) -> DocumentType:
        """
        Classify document as short or long based on token count.

        Args:
            token_count: Number of tokens in the document

        Returns:
            DocumentType.short if <= 15k tokens, DocumentType.long if > 15k tokens
        """
        if token_count <= self.token_threshold:
            return DocumentType.short
        else:
            return DocumentType.long

    def _process_pdf_sync(self, pdf_path: str) -> tuple[str, int, DocumentType]:
        """
        Synchronous PDF processing pipeline used internally by the async wrapper.

        This performs text extraction, token counting and document classification.
        """
        try:
            logger.info(f"Starting PDF processing for: {pdf_path}")

            # Step 1: Extract text from PDF
            extracted_text = self.extract_text_from_pdf(pdf_path)

            # Step 2: Count tokens
            token_count = self.count_tokens(extracted_text)

            # Step 3: Classify document type
            document_type = self.classify_document_type(token_count)

            logger.info(
                f"PDF processing completed. Tokens: {token_count}, Type: {document_type.value}"
            )

            return extracted_text, token_count, document_type

        except Exception as e:
            logger.error(f"PDF processing failed for {pdf_path}: {e!s}")
            raise

    async def process_pdf(self, pdf_path: str) -> tuple[str, int, DocumentType]:
        """
        Asynchronously process a PDF by offloading heavy work to a thread.
        """
        return await asyncio.to_thread(self._process_pdf_sync, pdf_path)

    async def process_long_pdf(self, asset: Asset, user_id: str, db: Session) -> dict:
        """
        Complete long PDF processing pipeline using RAG.

        This method is called after basic PDF processing when a document is classified as 'long'.
        It triggers the RAG pipeline to:
        1. Create text chunks
        2. Generate embeddings
        3. Store in vector database
        4. Update asset record with vector metadata

        Args:
            asset: Asset object with extracted text already populated
            user_id: User ID for access control
            db: Database session

        Returns:
            Dictionary with processing results and metadata

        Raises:
            Exception: If RAG processing fails
        """
        try:
            logger.info(f"Starting RAG processing for long PDF asset {asset.id}")

            # Validate that this is indeed a long document
            if asset.document_type != DocumentType.long:
                raise ValueError(
                    f"Asset {asset.id} is not classified as a long document"
                )

            if not asset.extracted_text:
                raise ValueError(f"Asset {asset.id} has no extracted text")

            # Record start time for processing duration calculation
            import time

            start_time = time.time()

            # Trigger RAG processing pipeline
            rag_result = await self.rag_service.process_document_for_rag(
                asset=asset, user_id=user_id, db=db
            )

            # Calculate processing time
            processing_time = time.time() - start_time

            # Update asset record with vector database information
            asset.vector_db_collection_id = rag_result["collection_id"]
            asset.chunk_count = rag_result["chunks_created"]
            asset.processing_metadata = {
                "rag_processing": {
                    "processing_time": processing_time,
                    "chunk_count": rag_result["chunks_created"],
                    "embedding_count": rag_result["embeddings_generated"],
                    "collection_id": rag_result["collection_id"],
                    "status": "completed",
                    "model_used": rag_result.get(
                        "embedding_model", "text-embedding-ada-002"
                    ),
                }
            }

            # Commit the changes without blocking
            await asyncio.to_thread(db.commit)

            logger.info(
                f"RAG processing completed for asset {asset.id}. Collection: {rag_result['collection_id']}"
            )

            return {
                "success": True,
                "asset_id": str(asset.id),
                "collection_id": rag_result["collection_id"],
                "chunk_count": rag_result["chunks_created"],
                "processing_time": processing_time,
                "method": "rag_processing",
            }

        except Exception as e:
            logger.error(f"RAG processing failed for asset {asset.id}: {e!s}")
            # Update asset with error information
            if asset.processing_metadata is None:
                asset.processing_metadata = {}
            asset.processing_metadata["rag_processing"] = {
                "status": "failed",
                "error": str(e),
            }
            await asyncio.to_thread(db.commit)
            raise Exception(f"RAG processing failed: {e!s}") from e

    def is_rag_processing_needed(self, asset: Asset) -> bool:
        """
        Check if an asset needs RAG processing.

        Args:
            asset: Asset to check

        Returns:
            True if RAG processing is needed, False otherwise
        """
        # RAG processing is needed for long documents that don't have a vector collection
        return (
            asset.document_type == DocumentType.long
            and asset.vector_db_collection_id is None
            and asset.extracted_text is not None
        )

    def _clean_text(self, text: str) -> str:
        """
        Clean extracted text by removing excessive whitespace and normalizing.

        Args:
            text: Raw extracted text

        Returns:
            Cleaned text
        """
        # Remove excessive whitespace and normalize
        import re

        # Replace multiple whitespaces with single space
        text = re.sub(r"\s+", " ", text)
        # Remove leading/trailing whitespace
        text = text.strip()
        return text
