import asyncio
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.db.models.asset import Asset
from app.services.rag_services.chunking_service import ChunkingService
from app.services.rag_services.embedding_service import EmbeddingService
from app.services.rag_services.vector_database_service import VectorDatabaseService


class RAGService:
    """
    Service for orchestrating Retrieval-Augmented Generation (RAG) workflows.

    This service coordinates:
    1. Text chunking for long documents
    2. Embedding generation for chunks
    3. Vector storage in ChromaDB
    4. Semantic search for relevant content
    5. Context assembly for AI generation
    """

    def __init__(self):
        # Initialize component services
        self.chunking_service = ChunkingService()
        self.embedding_service = EmbeddingService()
        self.vector_db_service = VectorDatabaseService()
        
        # Thread pool for CPU-intensive operations
        self.executor = ThreadPoolExecutor(max_workers=3)
        self.timeout = 120.0  # 2 minutes timeout for RAG operations

        # RAG configuration
        self.max_context_tokens = 4000  # Maximum tokens to send to AI
        self.retrieval_top_k = (
            10  # Number of chunks to retrieve - increased for better coverage
        )
        self.context_overlap_handling = True  # Remove overlapping content

        logger.info("RAGService initialized with all component services")

    async def process_document_for_rag(self, asset: Asset, user_id: str, db: Session) -> dict:
        """
        Complete RAG processing pipeline for a document.

        This method:
        1. Chunks the document text
        2. Generates embeddings for chunks
        3. Creates a vector database collection
        4. Stores embeddings with metadata
        5. Updates the asset record

        Args:
            asset: Asset object with extracted text
            user_id: User ID for access control
            db: Database session

        Returns:
            Dictionary with processing results and metadata

        Raises:
            Exception: If any step of the pipeline fails
        """
        try:
            logger.info(f"Starting RAG processing for asset {asset.id}")

            # Validate input
            if not asset.extracted_text:
                raise ValueError("Asset has no extracted text")

            processing_start_time = self._get_timestamp()

            # Step 1: Chunk the document (CPU-intensive, run in executor)
            logger.info("Step 1: Chunking document text")
            loop = asyncio.get_event_loop()
            chunks = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.chunking_service.chunk_text(
                        text=asset.extracted_text,
                        asset_id=str(asset.id),
                        source_filename=asset.source.split("/")[-1] if asset.source else None,
                    )
                ),
                timeout=self.timeout
            )

            if not chunks:
                raise ValueError("No chunks were created from the document")

            # Step 2: Generate embeddings (CPU-intensive, run in executor)
            logger.info("Step 2: Generating embeddings for chunks")
            embedded_chunks = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.embedding_service.generate_embeddings_for_chunks(chunks)
                ),
                timeout=self.timeout
            )

            # Step 3: Create vector database collection (CPU-intensive, run in executor)
            logger.info("Step 3: Creating vector database collection")
            collection_id = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.vector_db_service.create_collection_for_document(
                        asset_id=str(asset.id), user_id=user_id
                    )
                ),
                timeout=self.timeout
            )

            # Step 4: Store embeddings (CPU-intensive, run in executor)
            logger.info("Step 4: Storing embeddings in vector database")
            storage_success = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.vector_db_service.store_embeddings(
                        collection_id=collection_id, embedded_chunks=embedded_chunks
                    )
                ),
                timeout=self.timeout
            )

            if not storage_success:
                raise Exception("Failed to store embeddings in vector database")

            # Step 5: Update asset record without blocking the event loop
            logger.info("Step 5: Updating asset record with RAG metadata")
            await asyncio.to_thread(
                self._update_asset_with_rag_metadata,
                asset,
                collection_id,
                embedded_chunks,
                db,
            )

            # Generate processing statistics
            processing_stats = self._generate_processing_stats(
                chunks, embedded_chunks, processing_start_time
            )

            logger.info(f"RAG processing completed successfully for asset {asset.id}")

            return {
                "success": True,
                "collection_id": collection_id,
                "chunks_created": len(chunks),
                "embeddings_generated": len(embedded_chunks),
                "processing_stats": processing_stats,
            }

        except Exception as e:
            logger.error(f"RAG processing failed for asset {asset.id}: {e!s}")
            raise Exception(f"RAG processing failed: {e!s}") from e

    async def retrieve_relevant_context(
        self,
        collection_id: str,
        question: str,
        user_id: str = None,
        max_tokens: int = None,
    ) -> dict:
        """
        Retrieve relevant context for a question using semantic search.

        Args:
            collection_id: Vector database collection to search
            question: User's question
            user_id: User ID for access control
            max_tokens: Maximum tokens in the assembled context

        Returns:
            Dictionary with relevant chunks and assembled context

        Raises:
            Exception: If retrieval fails
        """
        try:
            logger.info(
                f"Retrieving relevant context for collection {collection_id}"
            )
            # Question content logging removed for security

            if max_tokens is None:
                max_tokens = self.max_context_tokens

            # Step 1: Generate embedding for the question (CPU-intensive, run in executor)
            logger.info("Step 1: Generating embedding for question...")
            loop = asyncio.get_event_loop()
            question_embedding = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.embedding_service.generate_single_embedding(question)
                ),
                timeout=self.timeout
            )
            logger.info(f"Generated embedding with {len(question_embedding)} dimensions")

            # Step 2: Perform semantic search (CPU-intensive, run in executor)
            logger.info("Step 2: Performing semantic search...")
            relevant_chunks = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: self.vector_db_service.semantic_search(
                        collection_id=collection_id,
                        query_embedding=question_embedding,
                        top_k=self.retrieval_top_k,
                        user_id=user_id,
                    )
                ),
                timeout=self.timeout
            )
            logger.info(f"Semantic search returned {len(relevant_chunks)} chunks")

            if not relevant_chunks:
                logger.warning("560❌ NO RELEVANT CHUNKS FOUND - this is the likely cause of the issue!")
                logger.warning(f"560Collection ID: {collection_id}")
                logger.warning(f"560Top-k setting: {self.retrieval_top_k}")
                # Question logging removed for security
                logger.warning("560Debugging checklist:")
                logger.warning("5601. Check if collection exists and has documents")
                logger.warning("5602. Verify similarity threshold isn't too high") 
                logger.warning("5603. Ensure question embedding was generated correctly")
                logger.warning("5604. Check if chunks were stored with correct user_id")
                return {
                    "relevant_chunks": [],
                    "assembled_context": "",
                    "total_chunks": 0,
                    "total_tokens": 0,
                    "retrieval_method": "semantic_search",
                }

            # Step 3: Assemble context from relevant chunks
            assembled_context = self._assemble_context_from_chunks(
                relevant_chunks, max_tokens
            )

            retrieval_result = {
                "relevant_chunks": relevant_chunks,
                "assembled_context": assembled_context["context"],
                "total_chunks": len(relevant_chunks),
                "total_tokens": assembled_context["total_tokens"],
                "chunks_used": assembled_context["chunks_used"],
                "retrieval_method": "semantic_search",
            }

            logger.info(
                f"Retrieved {len(relevant_chunks)} relevant chunks, assembled {assembled_context['total_tokens']} tokens"
            )

            return retrieval_result

        except Exception as e:
            logger.error(f"560Context retrieval failed: {e!s}")
            logger.error(f"560Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"560Stack trace in RAG service: {traceback.format_exc()}")
            raise Exception(f"Context retrieval failed: {e!s}") from e

    def _assemble_context_from_chunks(
        self, chunks: list[dict], max_tokens: int
    ) -> dict:
        """
        Assemble context text from relevant chunks, respecting token limits.

        Args:
            chunks: List of relevant chunks with similarity scores
            max_tokens: Maximum tokens allowed

        Returns:
            Dictionary with assembled context and metadata
        """
        try:
            # Sort chunks by similarity score (highest first)
            sorted_chunks = sorted(
                chunks, key=lambda x: x["similarity_score"], reverse=True
            )

            assembled_context = ""
            total_tokens = 0
            chunks_used = 0

            for chunk in sorted_chunks:
                chunk_text = chunk["text"]
                chunk_tokens = self.chunking_service.count_tokens(chunk_text)

                # Check if adding this chunk would exceed the limit
                if total_tokens + chunk_tokens > max_tokens:
                    logger.debug(
                        f"Stopping context assembly at {chunks_used} chunks to respect token limit"
                    )
                    break

                # Add chunk to context
                if assembled_context:
                    assembled_context += "\n\n"  # Separator between chunks

                # Add metadata comment (helpful for debugging)
                chunk_id = chunk.get("chunk_id", "unknown")
                similarity = chunk.get("similarity_score", 0)
                assembled_context += (
                    f"[Chunk {chunk_id}, Similarity: {similarity:.3f}]\n"
                )
                assembled_context += chunk_text

                total_tokens += chunk_tokens
                chunks_used += 1

            return {
                "context": assembled_context,
                "total_tokens": total_tokens,
                "chunks_used": chunks_used,
                "max_tokens": max_tokens,
            }

        except Exception as e:
            logger.error(f"Context assembly failed: {e!s}")
            raise Exception(f"Context assembly failed: {e!s}") from e

    def _update_asset_with_rag_metadata(
        self, asset: Asset, collection_id: str, embedded_chunks: list[dict], db: Session
    ) -> None:
        """
        Update the asset record with RAG processing metadata.

        Args:
            asset: Asset object to update
            collection_id: Vector database collection ID
            embedded_chunks: List of processed chunks
            db: Database session
        """
        try:
            # Update asset fields
            asset.vector_db_collection_id = collection_id
            asset.chunk_count = len(embedded_chunks)

            # Create processing metadata
            processing_metadata = {
                "rag_processed": True,
                "processing_timestamp": self._get_timestamp(),
                "collection_id": collection_id,
                "chunks_created": len(embedded_chunks),
                "embedding_model": self.embedding_service.embedding_model,
                "chunking_params": {
                    "chunk_size": self.chunking_service.chunk_size,
                    "chunk_overlap": self.chunking_service.chunk_overlap,
                },
            }

            asset.processing_metadata = processing_metadata

            # Commit changes
            db.commit()

            logger.info(f"Updated asset {asset.id} with RAG metadata")

        except Exception as e:
            logger.error(f"Failed to update asset with RAG metadata: {e!s}")
            db.rollback()
            raise

    def _generate_processing_stats(
        self, chunks: list[dict], embedded_chunks: list[dict], start_time: str
    ) -> dict:
        """
        Generate statistics about the RAG processing pipeline.

        Args:
            chunks: Original chunks
            embedded_chunks: Chunks with embeddings
            start_time: Processing start timestamp

        Returns:
            Dictionary with processing statistics
        """
        try:
            end_time = self._get_timestamp()

            # Get chunking stats
            chunking_stats = self.chunking_service.get_chunking_stats(chunks)

            # Get embedding stats
            embedding_stats = self.embedding_service.get_embedding_stats(
                embedded_chunks
            )

            processing_stats = {
                "processing_start": start_time,
                "processing_end": end_time,
                "chunking_stats": chunking_stats,
                "embedding_stats": embedding_stats,
                "pipeline_success": True,
            }

            return processing_stats

        except Exception as e:
            logger.error(f"Failed to generate processing stats: {e!s}")
            return {"error": str(e)}

    def get_collection_status(self, collection_id: str) -> dict:
        """
        Get the status and information about a vector database collection.

        Args:
            collection_id: Collection ID to check

        Returns:
            Dictionary with collection status and info
        """
        try:
            collection_info = self.vector_db_service.get_collection_info(collection_id)

            return {
                "collection_exists": "error" not in collection_info,
                "collection_info": collection_info,
                "ready_for_search": "error" not in collection_info
                and collection_info.get("count", 0) > 0,
            }

        except Exception as e:
            return {
                "collection_exists": False,
                "error": str(e),
                "ready_for_search": False,
            }

    def cleanup_collection(self, collection_id: str, user_id: str = None) -> bool:
        """
        Clean up a vector database collection.

        Args:
            collection_id: Collection ID to delete
            user_id: User ID for access control

        Returns:
            True if cleanup was successful
        """
        try:
            return self.vector_db_service.delete_collection(collection_id, user_id)
        except Exception as e:
            logger.error(f"Collection cleanup failed: {e!s}")
            return False

    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata."""
        from datetime import datetime

        return datetime.utcnow().isoformat()
    
    def cleanup(self):
        """Cleanup thread pool executor."""
        self.executor.shutdown(wait=True)
