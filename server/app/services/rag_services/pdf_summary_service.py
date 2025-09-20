import asyncio
import openai

from app.core.config import settings
from app.core.logger import logger
from app.db.models.asset import Asset, DocumentType
from app.services.rag_services.rag_service import RAGService


class PDFSummaryService:
    """
    Service for generating AI summaries of PDF documents.
    Now supports both short documents (full text) and long documents (RAG-based).
    """

    def __init__(self):
        openai.api_key = settings.OPENAI_API_KEY
        # Initialize RAG service for long document processing
        self.rag_service = RAGService()

    def generate_summary(self, asset: Asset, model: str = "gpt-4o") -> str | None:
        """
        Generate a summary for a PDF asset.

        Args:
            asset: PDF asset with extracted text
            model: AI model to use for summarization

        Returns:
            Generated summary or None if failed
        """
        if not asset.extracted_text:
            logger.warning(f"No extracted text available for asset {asset.id}")
            return None

        try:
            if asset.document_type == DocumentType.short:
                return self._generate_short_document_summary(asset, model)
            else:
                return self._generate_long_document_summary(asset, model)

        except Exception as e:
            logger.error(f"Failed to generate summary for asset {asset.id}: {e!s}")
            return None

    async def generate_summary_async(
        self, asset: Asset, model: str = "gpt-4o"
    ) -> str | None:
        """Asynchronously generate a summary by offloading to a thread."""
        return await asyncio.to_thread(self.generate_summary, asset, model)

    def _generate_short_document_summary(self, asset: Asset, model: str) -> str | None:
        """
        Generate summary for short documents using full text.
        """
        try:
            system_prompt = """You are an expert at creating concise, informative summaries of documents.
            Create a comprehensive summary that captures the key points, main arguments, and important details.

            Focus on:
            - Main topic and purpose
            - Key findings or arguments
            - Important data or evidence
            - Conclusions or recommendations
            - Target audience or context

            Format the summary in clear, well-structured paragraphs."""

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Please summarize this document:\n\n{asset.extracted_text}",
                },
            ]

            response = openai.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.9,
                max_tokens=800,  # Reasonable length for summaries
            )

            summary = response.choices[0].message.content
            logger.info(
                f"Successfully generated summary for short document {asset.id} ({len(summary)} characters)"
            )
            return summary

        except Exception as e:
            logger.error(
                f"Failed to generate summary for short document {asset.id}: {e!s}"
            )
            return None

    def _generate_long_document_summary(self, asset: Asset, model: str) -> str | None:
        """
        Generate summary for long documents using RAG-based approach.
        This method extracts key content and creates a comprehensive summary.
        """
        try:
            # Check if the document has been processed for RAG
            if not asset.vector_db_collection_id:
                logger.warning(
                    f"Asset {asset.id} has no vector collection. Cannot generate RAG-based summary."
                )
                # Fall back to a simple approach for now
                return self._generate_fallback_summary(asset, model)

            logger.info(f"Generating RAG-based summary for long document {asset.id}")

            # Step 1: Use multiple summary-oriented queries to extract key content
            summary_queries = [
                "What are the main topics and key points of this document?",
                "What are the most important findings, conclusions, and recommendations?",
                "What data, evidence, or examples are presented?",
                "What is the purpose and context of this document?",
            ]

            all_relevant_content = []
            total_context_tokens = 0
            max_total_tokens = 6000  # Generous limit for summary context

            for query in summary_queries:
                if total_context_tokens >= max_total_tokens:
                    break

                # Note: retrieve_relevant_context is async, but this method is sync
                # For now, we'll use the fallback method to avoid async issues
                import asyncio
                
                try:
                    retrieval_result = asyncio.run(
                        self.rag_service.retrieve_relevant_context(
                            collection_id=asset.vector_db_collection_id,
                            question=query,
                            max_tokens=1500,  # Per query limit
                        )
                    )
                except Exception as async_error:
                    logger.warning(f"Async retrieval failed for query '{query}': {async_error}")
                    continue

                if retrieval_result["assembled_context"]:
                    all_relevant_content.append(
                        f"[{query}]\n{retrieval_result['assembled_context']}"
                    )
                    total_context_tokens += retrieval_result.get("total_tokens", 0)

            if not all_relevant_content:
                logger.warning(
                    f"No relevant content found for summary of asset {asset.id}"
                )
                return self._generate_fallback_summary(asset, model)

            # Step 2: Combine all relevant content
            combined_context = "\n\n---\n\n".join(all_relevant_content)

            # Step 3: Generate comprehensive summary
            system_prompt = """You are an expert at creating comprehensive summaries of long documents.
            You have been provided with key excerpts from a long document that cover its main topics and important points.

            Create a well-structured summary that includes:
            - **Overview**: Main topic, purpose, and scope
            - **Key Points**: Primary arguments, findings, or concepts
            - **Important Details**: Significant data, evidence, or examples
            - **Conclusions**: Main outcomes, recommendations, or implications

            Format the summary with clear headings and well-organized paragraphs.
            Make it comprehensive enough to give readers a thorough understanding of the document's content."""

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Based on these key excerpts from a long document, create a comprehensive summary:\n\n{combined_context}",
                },
            ]

            response = openai.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=1200,  # Longer summaries for long documents
            )

            summary = response.choices[0].message.content

            # Add metadata about the summary method
            enhanced_summary = f"{summary}\n\n*Summary generated from {len(summary_queries)} analytical queries across the document's vector database.*"

            logger.info(
                f"Successfully generated RAG-based summary for long document {asset.id} ({len(enhanced_summary)} characters)"
            )
            return enhanced_summary

        except Exception as e:
            logger.error(
                f"Failed to generate RAG-based summary for asset {asset.id}: {e!s}"
            )
            return self._generate_fallback_summary(asset, model)

    def _generate_fallback_summary(self, asset: Asset, model: str) -> str | None:
        """
        Fallback summary method for long documents without RAG processing.
        Uses the first portion of the document.
        """
        try:
            # Use first 8000 tokens as a reasonable sample
            import tiktoken

            tokenizer = tiktoken.get_encoding("cl100k_base")
            tokens = tokenizer.encode(asset.extracted_text)

            if len(tokens) > 8000:
                truncated_tokens = tokens[:8000]
                truncated_text = tokenizer.decode(truncated_tokens)
            else:
                truncated_text = asset.extracted_text

            system_prompt = """You are an expert at creating summaries of documents.
            You have been provided with the beginning portion of a long document.
            Create a summary based on this content, but note that this represents only part of the full document.

            Focus on the main topics and key points you can identify from this portion."""

            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Please summarize this portion of a long document:\n\n{truncated_text}",
                },
            ]

            response = openai.chat.completions.create(
                model=model, messages=messages, temperature=0.7, max_tokens=600
            )

            summary = response.choices[0].message.content
            enhanced_summary = f"{summary}\n\n*Note: This summary is based on the beginning portion of a long document and may not reflect the complete content.*"

            logger.info(f"Generated fallback summary for long document {asset.id}")
            return enhanced_summary

        except Exception as e:
            logger.error(
                f"Fallback summary generation failed for asset {asset.id}: {e!s}"
            )
            return None
