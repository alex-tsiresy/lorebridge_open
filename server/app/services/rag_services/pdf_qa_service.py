import time

import openai
import tiktoken
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.db.models.asset import Asset, AssetStatus, AssetType, DocumentType
from app.services.rag_services.rag_service import RAGService
from app.services.providers.openai import OpenAIProvider


class PDFQAService:
    """
    Service for answering questions about PDF documents.

    This service handles:
    1. Question answering for short documents (direct context)
    2. Question answering for long documents (RAG - Phase 3)
    3. Integration with existing chat system
    4. User-scoped PDF access (users can only query their own PDFs)
    """

    def __init__(self):
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        openai.api_key = settings.OPENAI_API_KEY
        # Initialize RAG service for long document processing
        self.rag_service = RAGService()
        # Initialize OpenAI provider for async API calls
        self.openai_provider = OpenAIProvider()

    def find_user_pdfs(self, db: Session, user_id: str) -> list[Asset]:
        """
        Find PDF assets that are completed and ready for Q&A for a specific user.

        Args:
            db: Database session
            user_id: User ID (UUID string) to filter PDFs by
        """
        logger.info(f"Finding PDFs for user {user_id}")
        
        query = db.query(Asset).filter(
            Asset.type == AssetType.pdf,  # Use enum instead of string
            Asset.status == AssetStatus.completed,
            Asset.extracted_text.isnot(None),
            Asset.user_id == user_id,  # Asset model DOES have user_id field
        )

        # Order by most recently created
        pdfs = query.order_by(Asset.id.desc()).all()

        logger.info(f"Found {len(pdfs)} PDF assets ready for Q&A for user {user_id}")
        return pdfs

    async def answer_question_about_pdf(
        self,
        db: Session,
        user_id: str,
        question: str,
        asset_id: str = None,
        model: str = "gpt-4o",
    ) -> dict[str, any]:
        """
        Answer a question about a specific PDF or find the most relevant PDF for a user.

        Args:
            db: Database session
            user_id: Clerk user ID to ensure user can only query their own PDFs
            question: User's question
            asset_id: Optional specific PDF asset ID
            model: AI model to use for answering

        Returns:
            Dictionary with answer, metadata, and processing info
        """
        start_time = time.time()

        # Step 1: Find the PDF to question (user-scoped)
        if asset_id:
            pdf_asset = (
                db.query(Asset)
                .filter(
                    Asset.id == asset_id,
                    Asset.user_id == user_id,  # User isolation for security
                )
                .first()
            )
            if not pdf_asset:
                return {"error": f"PDF with ID {asset_id} not found or access denied", "success": False}
        else:
            # Find the most recent PDF for this user
            pdfs = self.find_user_pdfs(db, user_id)
            if not pdfs:
                return {
                    "error": "No PDF documents found. Please upload a PDF first.",
                    "success": False,
                }
            pdf_asset = pdfs[0]  # Use most recent

        if pdf_asset.status != AssetStatus.completed or not pdf_asset.extracted_text:
            return {
                "error": f"PDF '{pdf_asset.source}' is not ready for Q&A. Status: {pdf_asset.status}",
                "success": False,
            }

        # Step 2: Process based on document type
        try:
            if pdf_asset.document_type == DocumentType.short:
                answer_data = await self._answer_short_document(pdf_asset, question, model)
            else:
                # For Phase 2, we'll handle long documents with truncation
                # Phase 3 will add proper RAG with vector database
                answer_data = await self._answer_long_document_rag(pdf_asset, question, model, user_id)

            processing_time = time.time() - start_time

            # Build the response with all available metadata
            response_data = {
                "success": True,
                "answer": answer_data["answer"],
                "pdf_title": pdf_asset.source.split("/")[-1],  # Extract filename
                "pdf_id": str(pdf_asset.id),
                "document_type": pdf_asset.document_type.value,
                "token_count": pdf_asset.token_count,
                "model_used": model,
                "processing_time": round(processing_time, 2),
                "method": answer_data["method"],
            }

            # Add RAG-specific metadata if available
            if "chunks_used" in answer_data:
                response_data["chunks_used"] = answer_data["chunks_used"]
            if "context_tokens" in answer_data:
                response_data["context_tokens"] = answer_data["context_tokens"]
            if "relevant_chunks" in answer_data:
                response_data["relevant_chunks"] = answer_data["relevant_chunks"]

            return response_data

        except Exception as e:
            logger.error(f"Error answering question about PDF {pdf_asset.id}: {e!s}")
            return {"error": f"Failed to process question: {e!s}", "success": False}

    async def _answer_short_document(
        self, asset: Asset, question: str, model: str
    ) -> dict[str, any]:
        """
        Answer question using full document context for short documents.
        Also creates logical chunks for display in the UI.
        """
        system_prompt = """You are a helpful AI assistant that answers questions about PDF documents.
        You have been provided with the full text of a PDF document. Answer the user's question based on the content of this document.

        If the question cannot be answered from the document, say so clearly.
        Be accurate and cite specific parts of the document when possible."""

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Document content:\n\n{asset.extracted_text}\n\nQuestion: {question}",
            },
        ]

        # Use async OpenAI client to avoid blocking
        response = await self.openai_provider.achat_completions(
            messages=messages, model=model, temperature=0.3, max_tokens=1000
        )

        # For short documents, create display chunks by splitting into logical sections
        # This provides transparency about what content was used
        relevant_chunks = self._create_display_chunks_for_short_document(
            asset.extracted_text, asset.id
        )

        return {
            "answer": response.choices[0].message.content,
            "method": "full_context",
            "chunks_used": len(relevant_chunks),
            "context_tokens": self._count_tokens(asset.extracted_text),
            "relevant_chunks": relevant_chunks,
        }

    async def _answer_long_document_rag(
        self, asset: Asset, question: str, model: str, user_id: str
    ) -> dict[str, any]:
        """
        Answer question for long documents using RAG (Retrieval-Augmented Generation).
        This replaces the old truncation method with intelligent semantic search.
        """
        try:
            # Check if the document has been processed for RAG
            if not asset.vector_db_collection_id:
                logger.warning(
                    f"Asset {asset.id} has no vector collection. Cannot use RAG."
                )
                # Fall back to truncation method if RAG is not available
                return await self._answer_long_document_simple(asset, question, model)

            logger.info(f"560🔍 Using RAG to answer question for asset {asset.id}")
            logger.info(f"560📊 Vector collection ID: {asset.vector_db_collection_id}")
            logger.info(f"560❓ Question: '{question}'")
            
            # Check if the collection actually exists and has data
            collection_status = self.rag_service.get_collection_status(asset.vector_db_collection_id)
            logger.info(f"560📋 Collection status: {collection_status}")
            
            if not collection_status.get("ready_for_search", False):
                logger.warning(f"560⚠️ Collection {asset.vector_db_collection_id} is not ready for search")
                logger.warning("Falling back to simple truncated document method")
                return await self._answer_long_document_simple(asset, question, model)

            # Step 1: Retrieve relevant context using RAG
            logger.info("560🔎 Starting RAG retrieval...")
            retrieval_result = await self.rag_service.retrieve_relevant_context(
                collection_id=asset.vector_db_collection_id,
                question=question,
                user_id=user_id,  # Pass user_id for access control
                max_tokens=3500,  # Leave room for question and response
            )

            logger.info(f"560📈 Retrieval result: {retrieval_result.get('total_chunks', 0)} chunks, {retrieval_result.get('total_tokens', 0)} tokens")

            if not retrieval_result["assembled_context"]:
                # No relevant context found
                logger.warning("560❌ No relevant context found in RAG retrieval!")
                logger.warning("This means either:")
                logger.warning("1. Similarity threshold is too high")
                logger.warning("2. Question doesn't match document content semantically")
                logger.warning("3. Chunks weren't stored properly")
                return {
                    "answer": "I couldn't find relevant information in the document to answer your question. "
                    "The document may not contain information related to your query, or you might want to "
                    "try rephrasing your question with different keywords.",
                    "method": "rag_no_context",
                }

            logger.info(f"560✅ Retrieved context with {retrieval_result.get('total_chunks', 0)} chunks")

            # Step 2: Create enhanced prompt with retrieved context
            system_prompt = """You are a helpful AI assistant that answers questions about PDF documents using relevant excerpts.
            You have been provided with the most relevant sections from a long document that relate to the user's question.

            Instructions:
            - Answer the question based ONLY on the provided context excerpts
            - If the context doesn't contain enough information to fully answer the question, say so clearly
            - Cite specific parts of the context when possible
            - If you're unsure about something, acknowledge the uncertainty
            - Be accurate and don't make assumptions beyond what's stated in the context

            The context excerpts are sorted by relevance to the question."""

            # Include context information in the user message
            context_info = f"""
Relevant excerpts from the document:

{retrieval_result["assembled_context"]}

Based on these excerpts, please answer the following question: {question}
"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context_info},
            ]

            # Step 3: Generate answer using async OpenAI client
            response = await self.openai_provider.achat_completions(
                messages=messages, model=model, temperature=0.3, max_tokens=1000
            )

            answer = response.choices[0].message.content

            # Step 4: Add metadata about the RAG process
            chunks_used = retrieval_result.get("total_chunks", 0)
            context_tokens = retrieval_result.get("total_tokens", 0)
            relevant_chunks = retrieval_result.get("relevant_chunks", [])

            enhanced_answer = f"{answer}\n\n*Source: Based on {chunks_used} relevant sections from the document ({context_tokens} tokens of context used)*"

            logger.info(
                f"RAG answer generated for asset {asset.id} using {chunks_used} chunks"
            )

            return {
                "answer": enhanced_answer,
                "method": "rag_semantic_search",
                "chunks_used": chunks_used,
                "context_tokens": context_tokens,
                "relevant_chunks": relevant_chunks,
            }

        except Exception as e:
            logger.error(f"560RAG-based Q&A failed for asset {asset.id}: {e!s}")
            logger.error(f"560Exception type: {type(e).__name__}")
            logger.error(f"560Exception details: {str(e)}")
            import traceback
            logger.error(f"560Stack trace: {traceback.format_exc()}")
            
            # Fall back to simple method if RAG fails
            logger.info(f"560🔄 Falling back to truncation method for asset {asset.id}")
            try:
                fallback_result = await self._answer_long_document_simple(asset, question, model)
                # Add fallback indicator to the response
                fallback_result["answer"] += "\n\n*Note: Advanced search temporarily unavailable, showing results from document beginning.*"
                return fallback_result
            except Exception as fallback_error:
                logger.error(f"560Fallback method also failed: {fallback_error!s}")
                return {
                    "answer": "I apologize, but I'm unable to process your question about this PDF at the moment. "
                    "Please try again later or contact support if the issue persists.",
                    "method": "error_fallback",
                    "success": False
                }

    async def _answer_long_document_simple(
        self, asset: Asset, question: str, model: str
    ) -> dict[str, any]:
        """
        Answer question for long documents using truncated context.
        This is a Phase 2 implementation - Phase 3 will add proper RAG.
        """
        # For now, truncate to first ~10k tokens to fit in context window
        truncated_text = self._truncate_to_tokens(asset.extracted_text, 10000)

        system_prompt = """You are a helpful AI assistant that answers questions about PDF documents.
        You have been provided with the beginning portion of a long PDF document. Answer the user's question based on this content.

        IMPORTANT: If the question seems to require information that might be later in the document,
        mention that you only have access to the beginning of the document and suggest the user ask more specific questions about the early sections."""

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Document content (beginning portion):\n\n{truncated_text}\n\nQuestion: {question}",
            },
        ]

        # Use async OpenAI client to avoid blocking
        response = await self.openai_provider.achat_completions(
            messages=messages, model=model, temperature=0.3, max_tokens=1000
        )

        return {
            "answer": response.choices[0].message.content
            + "\n\n*Note: This answer is based on the beginning portion of a long document.*",
            "method": "truncated_context",
        }

    def _truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """
        Truncate text to approximately max_tokens.
        """
        tokens = self.tokenizer.encode(text)
        if len(tokens) <= max_tokens:
            return text

        truncated_tokens = tokens[:max_tokens]
        return self.tokenizer.decode(truncated_tokens)

    def _count_tokens(self, text: str) -> int:
        """Count tokens in text using the tokenizer."""
        return len(self.tokenizer.encode(text))

    def _create_display_chunks_for_short_document(self, text: str, asset_id) -> list:
        """
        Create display chunks for short documents by splitting into logical sections.
        This provides transparency about the document structure in the UI.
        """
        # Split by double newlines (paragraphs) and other logical breaks
        import re
        
        # Split on various paragraph markers
        sections = re.split(r'\n\s*\n|\r\n\s*\r\n', text)
        
        # Filter out very short sections and combine if needed
        filtered_sections = []
        current_section = ""
        
        for section in sections:
            section = section.strip()
            if not section:
                continue
                
            # If section is very short, combine with previous
            if len(section) < 100 and current_section:
                current_section += f"\n\n{section}"
            else:
                if current_section:
                    filtered_sections.append(current_section)
                current_section = section
        
        # Add the last section
        if current_section:
            filtered_sections.append(current_section)
        
        # Create chunk objects similar to RAG format
        chunks = []
        for i, section in enumerate(filtered_sections[:10]):  # Limit to 10 chunks for display
            chunk = {
                "chunk_id": f"short_doc_{asset_id}_{i}",
                "text": section,
                "similarity_score": 1.0,  # All sections are equally relevant for short docs
                "metadata": {
                    "section": i + 1,
                    "total_sections": len(filtered_sections),
                    "document_type": "short"
                }
            }
            chunks.append(chunk)
        
        logger.info(f"Created {len(chunks)} display chunks for short document {asset_id}")
        return chunks

    def list_available_pdfs(self, db: Session, user_id: str) -> list[dict[str, any]]:
        """
        List all PDFs available for Q&A with metadata for a specific user.

        Args:
            db: Database session
            user_id: Clerk user ID to filter PDFs by

        Returns:
            List of user's PDF documents with metadata
        """
        pdfs = self.find_user_pdfs(db, user_id)

        return [
            {
                "id": str(pdf.id),
                "title": pdf.source.split("/")[-1],
                "url": pdf.source,
                "token_count": pdf.token_count,
                "document_type": (
                    pdf.document_type.value if pdf.document_type else "unknown"
                ),
                "ready_for_qa": pdf.status == AssetStatus.completed
                and pdf.extracted_text is not None,
            }
            for pdf in pdfs
        ]
