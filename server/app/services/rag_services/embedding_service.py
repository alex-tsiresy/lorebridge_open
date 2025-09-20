import time

from app.core.logger import logger
from app.services.providers.openai import OpenAIProvider


class EmbeddingService:
    """
    Service for generating vector embeddings from text chunks using OpenAI's API.

    This service handles:
    1. Converting text chunks to vector embeddings
    2. Batch processing for efficiency
    3. Error handling and retries
    4. Embedding metadata management
    5. Token usage tracking
    """

    def __init__(self):
        # Initialize OpenAI provider
        self.openai_provider = OpenAIProvider()

        # Embedding configuration
        self.embedding_model = (
            "text-embedding-ada-002"  # OpenAI's most cost-effective model
        )
        self.max_batch_size = 100  # OpenAI allows up to 2048 inputs per batch
        self.max_retries = 3
        self.retry_delay = 1  # seconds

        # Embedding dimensions (ada-002 produces 1536-dimensional vectors)
        self.embedding_dimensions = 1536

        logger.info(f"EmbeddingService initialized with model: {self.embedding_model}")

    def generate_embeddings_for_chunks(self, chunks: list[dict]) -> list[dict]:
        """
        Generate embeddings for a list of text chunks.

        Args:
            chunks: List of chunk dictionaries with 'text' and 'metadata' fields

        Returns:
            List of chunks with added 'embedding' field

        Raises:
            Exception: If embedding generation fails
        """
        try:
            logger.info(f"Starting embedding generation for {len(chunks)} chunks")
            start_time = time.time()

            if not chunks:
                raise ValueError("No chunks provided for embedding")

            # Validate chunks format
            self._validate_chunks_format(chunks)

            # Process chunks in batches
            embedded_chunks = []
            total_tokens = 0

            for batch_start in range(0, len(chunks), self.max_batch_size):
                batch_end = min(batch_start + self.max_batch_size, len(chunks))
                batch_chunks = chunks[batch_start:batch_end]

                logger.info(
                    f"Processing embedding batch {batch_start // self.max_batch_size + 1}: chunks {batch_start + 1}-{batch_end}"
                )

                # Generate embeddings for this batch
                batch_result = self._process_embedding_batch(batch_chunks)
                embedded_chunks.extend(batch_result["chunks"])
                total_tokens += batch_result["tokens_used"]

                # Small delay between batches to respect rate limits
                if batch_end < len(chunks):
                    time.sleep(0.1)

            processing_time = time.time() - start_time

            logger.info(
                f"Successfully generated embeddings for {len(embedded_chunks)} chunks in {processing_time:.2f}s"
            )
            logger.info(f"Total tokens used: {total_tokens}")

            return embedded_chunks

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e!s}")
            raise Exception(f"Embedding generation failed: {e!s}") from e

    def _process_embedding_batch(self, batch_chunks: list[dict]) -> dict:
        """
        Process a single batch of chunks for embedding generation.

        Args:
            batch_chunks: List of chunks to process

        Returns:
            Dictionary with processed chunks and token usage
        """
        try:
            # Extract text from chunks
            texts = [chunk["text"] for chunk in batch_chunks]

            # Generate embeddings with retries
            embeddings_response = self._generate_embeddings_with_retry(texts)

            # Process the response
            embeddings_data = embeddings_response.data
            tokens_used = embeddings_response.usage.total_tokens

            # Combine chunks with their embeddings
            embedded_chunks = []
            for i, chunk in enumerate(batch_chunks):
                # Create a copy of the chunk
                embedded_chunk = chunk.copy()

                # Add embedding data
                embedded_chunk["embedding"] = embeddings_data[i].embedding
                embedded_chunk["embedding_model"] = self.embedding_model
                embedded_chunk["embedding_dimensions"] = len(
                    embeddings_data[i].embedding
                )

                # Update metadata
                embedded_chunk["metadata"]["embedding_generated"] = True
                embedded_chunk["metadata"]["embedding_model"] = self.embedding_model
                embedded_chunk["metadata"]["embedding_timestamp"] = (
                    self._get_timestamp()
                )

                embedded_chunks.append(embedded_chunk)

            return {"chunks": embedded_chunks, "tokens_used": tokens_used}

        except Exception as e:
            logger.error(f"Failed to process embedding batch: {e!s}")
            raise

    def _generate_embeddings_with_retry(self, texts: list[str]) -> object:
        """
        Generate embeddings with retry logic for rate limiting and temporary errors.

        Args:
            texts: List of texts to embed

        Returns:
            OpenAI embeddings response
        """
        last_error = None

        for attempt in range(self.max_retries):
            try:
                logger.debug(f"Embedding attempt {attempt + 1} for {len(texts)} texts")

                # Call OpenAI embedding API
                response = self.openai_provider.embed(
                    input=texts, model=self.embedding_model
                )

                return response

            except Exception as e:
                last_error = e
                logger.warning(f"Embedding attempt {attempt + 1} failed: {e!s}")

                # Check if it's a rate limit error
                if (
                    "rate_limit" in str(e).lower()
                    or "too_many_requests" in str(e).lower()
                ):
                    wait_time = self.retry_delay * (2**attempt)  # Exponential backoff
                    logger.info(f"Rate limited. Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                elif attempt < self.max_retries - 1:
                    # For other errors, wait briefly before retry
                    time.sleep(self.retry_delay)
                else:
                    # Final attempt failed
                    break

        # All retries failed
        raise Exception(
            f"Failed to generate embeddings after {self.max_retries} attempts. Last error: {last_error}"
        )

    def generate_single_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text (useful for queries).

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats
        """
        try:
            response = self._generate_embeddings_with_retry([text])
            return response.data[0].embedding

        except Exception as e:
            logger.error(f"Failed to generate single embedding: {e!s}")
            raise Exception(f"Single embedding generation failed: {e!s}") from e

    def _validate_chunks_format(self, chunks: list[dict]) -> None:
        """
        Validate that chunks have the required format for embedding.

        Args:
            chunks: List of chunks to validate

        Raises:
            ValueError: If chunks are not properly formatted
        """
        if not chunks:
            raise ValueError("Empty chunks list")

        for i, chunk in enumerate(chunks):
            if not isinstance(chunk, dict):
                raise ValueError(f"Chunk {i} is not a dictionary")

            if "text" not in chunk:
                raise ValueError(f"Chunk {i} missing 'text' field")

            if not chunk["text"] or not chunk["text"].strip():
                raise ValueError(f"Chunk {i} has empty text")

            if "metadata" not in chunk:
                raise ValueError(f"Chunk {i} missing 'metadata' field")

            # Check text length (OpenAI has a limit)
            if len(chunk["text"]) > 8000:  # Conservative limit
                logger.warning(
                    f"Chunk {i} is very long ({len(chunk['text'])} chars) - may hit API limits"
                )

    def get_embedding_stats(self, embedded_chunks: list[dict]) -> dict:
        """
        Generate statistics about the embedding process.

        Args:
            embedded_chunks: List of chunks with embeddings

        Returns:
            Dictionary with embedding statistics
        """
        if not embedded_chunks:
            return {"error": "No embedded chunks provided"}

        # Count successfully embedded chunks
        embedded_count = len(
            [chunk for chunk in embedded_chunks if "embedding" in chunk]
        )

        # Check embedding dimensions consistency
        dimensions = set()
        for chunk in embedded_chunks:
            if "embedding" in chunk:
                dimensions.add(len(chunk["embedding"]))

        stats = {
            "total_chunks": len(embedded_chunks),
            "successfully_embedded": embedded_count,
            "embedding_success_rate": (
                embedded_count / len(embedded_chunks) if embedded_chunks else 0
            ),
            "embedding_model": self.embedding_model,
            "embedding_dimensions": list(dimensions),
            "dimensions_consistent": len(dimensions) <= 1,
        }

        return stats

    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata."""
        from datetime import datetime

        return datetime.utcnow().isoformat()
