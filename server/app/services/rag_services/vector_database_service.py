import chromadb
from chromadb.config import Settings

from app.core.config import settings
from app.core.logger import logger


class VectorDatabaseService:
    """
    Service for managing vector storage and retrieval using ChromaDB.

    This service handles:
    1. Creating and managing ChromaDB collections
    2. Storing embeddings with metadata
    3. Semantic search functionality
    4. User-scoped access control
    5. Collection cleanup and management
    """

    def __init__(self):
        # ChromaDB configuration
        self.chroma_db_path = getattr(settings, "CHROMA_DB_PATH", "storage/chroma_db")
        self.collection_name_prefix = "pdf_"

        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path=self.chroma_db_path,
            settings=Settings(
                anonymized_telemetry=False,  # Disable telemetry for privacy
                allow_reset=True,
            ),
        )

        # Search configuration
        self.default_top_k = 5  # Number of chunks to retrieve
        self.similarity_threshold = (
            0.0  # Minimum similarity score - disabled for better recall, let the AI decide relevance
        )

        logger.info(
            f"VectorDatabaseService initialized with path: {self.chroma_db_path}"
        )

    def create_collection_for_document(self, asset_id: str, user_id: str) -> str:
        """
        Create a new ChromaDB collection for a document.

        Args:
            asset_id: Unique identifier for the asset
            user_id: User ID for access control

        Returns:
            Collection ID (name)

        Raises:
            Exception: If collection creation fails
        """
        try:
            # Create unique collection name
            collection_id = f"{self.collection_name_prefix}{asset_id}"

            logger.info(f"Creating ChromaDB collection: {collection_id}")

            # Create collection with metadata
            _ = self.chroma_client.create_collection(
                name=collection_id,
                metadata={
                    "asset_id": asset_id,
                    "user_id": str(
                        user_id
                    ),  # Convert UUID to string for ChromaDB compatibility
                    "created_at": self._get_timestamp(),
                    "description": f"Vector embeddings for PDF asset {asset_id}",
                },
            )

            logger.info(f"Successfully created collection {collection_id}")
            return collection_id

        except Exception as e:
            logger.error(f"Failed to create collection for asset {asset_id}: {e!s}")
            raise Exception(f"Collection creation failed: {e!s}") from e

    def store_embeddings(self, collection_id: str, embedded_chunks: list[dict]) -> bool:
        """
        Store embeddings and metadata in a ChromaDB collection.

        Args:
            collection_id: Name of the collection to store in
            embedded_chunks: List of chunks with embeddings and metadata

        Returns:
            True if storage was successful

        Raises:
            Exception: If storage fails
        """
        try:
            logger.info(
                f"Storing {len(embedded_chunks)} embeddings in collection {collection_id}"
            )

            if not embedded_chunks:
                raise ValueError("No embedded chunks provided")

            # Get the collection
            collection = self.chroma_client.get_collection(collection_id)

            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            documents = []

            for chunk in embedded_chunks:
                if "embedding" not in chunk:
                    logger.warning(
                        f"Chunk missing embedding, skipping: {chunk.get('metadata', {}).get('chunk_id', 'unknown')}"
                    )
                    continue

                # Extract data
                chunk_id = chunk["metadata"]["chunk_id"]
                embedding = chunk["embedding"]
                metadata = chunk["metadata"].copy()  # Copy to avoid modifying original
                document_text = chunk["text"]

                # Prepare metadata for ChromaDB (only JSON-serializable values)
                chroma_metadata = self._prepare_metadata_for_chroma(metadata)

                ids.append(chunk_id)
                embeddings.append(embedding)
                metadatas.append(chroma_metadata)
                documents.append(document_text)

            if not ids:
                raise ValueError("No valid chunks with embeddings found")

            # Store in ChromaDB
            collection.add(
                ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents
            )

            logger.info(
                f"Successfully stored {len(ids)} embeddings in collection {collection_id}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to store embeddings in collection {collection_id}: {e!s}"
            )
            raise Exception(f"Embedding storage failed: {e!s}") from e

    def semantic_search(
        self,
        collection_id: str,
        query_embedding: list[float],
        top_k: int = None,
        user_id: str = None,
    ) -> list[dict]:
        """
        Perform semantic search to find relevant chunks.

        Args:
            collection_id: Name of the collection to search
            query_embedding: Vector embedding of the search query
            top_k: Number of results to return (default: self.default_top_k)
            user_id: User ID for access control (optional)

        Returns:
            List of relevant chunks with similarity scores

        Raises:
            Exception: If search fails
        """
        try:
            if top_k is None:
                top_k = self.default_top_k

            logger.info(
                f"Performing semantic search in collection {collection_id} for top {top_k} results"
            )

            # Get the collection
            collection = self.chroma_client.get_collection(collection_id)
            collection_count = collection.count()
            logger.info(f"560Collection {collection_id} has {collection_count} documents")

            # Verify user access if user_id provided
            if user_id:
                self._verify_user_access(collection, user_id)

            # Perform search
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )

            # Debug the raw results
            # Debug the raw results - fix the logging bug
            ids_count = len(results.get('ids', [[]])[0]) if results.get('ids') and results.get('ids')[0] else 0
            distances_preview = results.get('distances', [[]])[0][:3] if results.get('distances') and results.get('distances')[0] else []
            logger.info(f"560Raw search results: ids_count={ids_count}, distances_preview={distances_preview}")

            # Process results
            relevant_chunks = []
            all_chunks_for_debug = []

            if results["ids"] and results["ids"][0]:  # Check if we have results
                logger.info(f"Processing {len(results['ids'][0])} chunks from search results")
                for i in range(len(results["ids"][0])):
                    chunk_id = results["ids"][0][i]
                    document = results["documents"][0][i]
                    metadata = results["metadatas"][0][i]
                    distance = results["distances"][0][i]

                    # Convert distance to similarity score (ChromaDB uses cosine distance)
                    similarity_score = 1 - distance

                    # Store all chunks for debugging
                    chunk_debug_info = {
                        "chunk_id": chunk_id,
                        "similarity_score": similarity_score,
                        "distance": distance,
                        "passes_threshold": similarity_score >= self.similarity_threshold,
                        "text_preview": document[:100] + "..." if len(document) > 100 else document
                    }
                    all_chunks_for_debug.append(chunk_debug_info)
                    
                    # Log individual chunk evaluation
                    logger.debug(f"Chunk {chunk_id}: score={similarity_score:.3f}, passes_threshold={similarity_score >= self.similarity_threshold}, text_preview='{chunk_debug_info['text_preview']}'")

                    # Filter by similarity threshold
                    if similarity_score >= self.similarity_threshold:
                        chunk = {
                            "chunk_id": chunk_id,
                            "text": document,
                            "metadata": metadata,
                            "similarity_score": similarity_score,
                            "distance": distance,
                        }
                        relevant_chunks.append(chunk)
                        logger.info(f"560✓ Chunk {chunk_id} included (score: {similarity_score:.3f})")
                    else:
                        logger.info(f"560✗ Chunk {chunk_id} filtered out (score: {similarity_score:.3f} < threshold: {self.similarity_threshold})")
            else:
                logger.warning("560No search results returned from ChromaDB - this could indicate:")
                logger.warning("5601. Collection is empty (no chunks stored)")
                logger.warning("5602. Query embedding failed")
                logger.warning("5603. Collection doesn't exist")

            # Enhanced logging for debugging
            logger.info(f"560Search results: {ids_count} total chunks returned from ChromaDB")
            similarity_scores = [f"{chunk['similarity_score']:.3f}" for chunk in all_chunks_for_debug[:5]]
            logger.info(f"560Top 5 similarity scores: {similarity_scores}")
            logger.info(f"560Threshold: {self.similarity_threshold}, Chunks above threshold: {len(relevant_chunks)}")
            
            if len(relevant_chunks) == 0:
                if len(all_chunks_for_debug) > 0:
                    best_score = max(chunk["similarity_score"] for chunk in all_chunks_for_debug)
                    logger.warning(f"❌ NO CHUNKS PASSED THRESHOLD! Best score was {best_score:.3f} (threshold: {self.similarity_threshold})")
                    logger.warning("Consider lowering the similarity threshold if this is too restrictive")
                    # Show details of top chunks that were filtered out
                    top_filtered = sorted(all_chunks_for_debug, key=lambda x: x["similarity_score"], reverse=True)[:3]
                    for i, chunk in enumerate(top_filtered, 1):
                        logger.warning(f"Top filtered chunk #{i}: {chunk['chunk_id']} (score: {chunk['similarity_score']:.3f})")
                else:
                    logger.error("❌ NO CHUNKS RETURNED FROM SEARCH - Collection might be empty or query failed")
            else:
                logger.info(f"✅ Found {len(relevant_chunks)} relevant chunks passing threshold")

            logger.info(
                f"Found {len(relevant_chunks)} relevant chunks (above threshold {self.similarity_threshold})"
            )
            return relevant_chunks

        except Exception as e:
            logger.error(f"Semantic search failed in collection {collection_id}: {e!s}")
            raise Exception(f"Semantic search failed: {e!s}") from e

    def get_collection_info(self, collection_id: str) -> dict:
        """
        Get information about a ChromaDB collection.

        Args:
            collection_id: Name of the collection

        Returns:
            Dictionary with collection information
        """
        try:
            collection = self.chroma_client.get_collection(collection_id)

            # Get collection metadata
            collection_info = {
                "collection_id": collection_id,
                "metadata": collection.metadata,
                "count": collection.count(),
            }

            return collection_info

        except Exception as e:
            logger.error(f"Failed to get collection info for {collection_id}: {e!s}")
            return {"error": str(e)}

    def delete_collection(self, collection_id: str, user_id: str = None) -> bool:
        """
        Delete a ChromaDB collection.

        Args:
            collection_id: Name of the collection to delete
            user_id: User ID for access control (optional)

        Returns:
            True if deletion was successful
        """
        try:
            logger.info(f"Deleting collection {collection_id}")

            # Verify user access if user_id provided
            if user_id:
                collection = self.chroma_client.get_collection(collection_id)
                self._verify_user_access(collection, user_id)

            # Delete the collection
            self.chroma_client.delete_collection(collection_id)

            logger.info(f"Successfully deleted collection {collection_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete collection {collection_id}: {e!s}")
            return False

    def list_collections(self, user_id: str = None) -> list[dict]:
        """
        List all collections, optionally filtered by user.

        Args:
            user_id: User ID to filter collections (optional)

        Returns:
            List of collection information
        """
        try:
            collections = self.chroma_client.list_collections()

            collection_list = []
            for collection in collections:
                # Get basic info
                info = {
                    "collection_id": collection.name,
                    "metadata": collection.metadata,
                    "count": collection.count(),
                }

                # Filter by user if requested
                if user_id:
                    collection_user_id = collection.metadata.get("user_id")
                    if collection_user_id != user_id:
                        continue

                collection_list.append(info)

            return collection_list

        except Exception as e:
            logger.error(f"Failed to list collections: {e!s}")
            return []

    def _verify_user_access(self, collection, user_id: str) -> None:
        """
        Verify that a user has access to a collection.

        Args:
            collection: ChromaDB collection object
            user_id: User ID to verify

        Raises:
            PermissionError: If user doesn't have access
        """
        collection_user_id = collection.metadata.get("user_id")
        if collection_user_id and collection_user_id != user_id:
            raise PermissionError(
                f"User {user_id} does not have access to collection {collection.name}"
            )

    def _prepare_metadata_for_chroma(self, metadata: dict) -> dict:
        """
        Prepare metadata for ChromaDB storage (only JSON-serializable values).

        Args:
            metadata: Original metadata dictionary

        Returns:
            ChromaDB-compatible metadata dictionary
        """
        chroma_metadata = {}

        for key, value in metadata.items():
            # Only include JSON-serializable types
            if isinstance(value, str | int | float | bool):
                chroma_metadata[key] = value
            elif value is None:
                chroma_metadata[key] = ""
            else:
                # Convert other types to string
                chroma_metadata[key] = str(value)

        return chroma_metadata

    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata."""
        from datetime import datetime

        return datetime.utcnow().isoformat()

    def health_check(self) -> dict:
        """
        Check the health of the vector database service.

        Returns:
            Dictionary with health status
        """
        try:
            # Try to list collections
            collections = self.chroma_client.list_collections()

            return {
                "status": "healthy",
                "chroma_db_path": self.chroma_db_path,
                "total_collections": len(collections),
                "timestamp": self._get_timestamp(),
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": self._get_timestamp(),
            }
