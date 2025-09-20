import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.logger import logger


class ChunkingService:
    """
    Service for intelligently chunking long text documents for vector storage.

    This service handles:
    1. Breaking long text into semantic chunks
    2. Preserving sentence boundaries
    3. Creating overlap between chunks to maintain context
    4. Optimizing chunk size for embeddings (500-1000 tokens)
    5. Adding metadata for each chunk (page numbers, section info)
    """

    def __init__(self):
        # Initialize tiktoken encoder for token counting
        self.tokenizer = tiktoken.get_encoding("cl100k_base")

        # Chunking parameters - optimized for embeddings
        self.chunk_size = 800  # tokens per chunk
        self.chunk_overlap = 100  # tokens overlap between chunks
        self.min_chunk_size = 200  # minimum viable chunk size
        self.max_chunks_per_document = 500  # safety limit

        # Initialize the text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size
            * 4,  # Approximate character count (4 chars ≈ 1 token)
            chunk_overlap=self.chunk_overlap * 4,  # Overlap in characters
            length_function=len,
            separators=[
                "\n\n",  # Paragraph breaks (highest priority)
                "\n",  # Line breaks
                ". ",  # Sentence ends
                "! ",  # Exclamation sentences
                "? ",  # Question sentences
                "; ",  # Semicolon breaks
                ", ",  # Comma breaks
                " ",  # Word breaks
                "",  # Character breaks (last resort)
            ],
            keep_separator=True,
        )

    def chunk_text(
        self, text: str, asset_id: str, source_filename: str = None
    ) -> list[dict]:
        """
        Break text into semantic chunks suitable for vector storage.

        Args:
            text: Full text content to chunk
            asset_id: ID of the asset being chunked
            source_filename: Optional filename for metadata

        Returns:
            List of chunk dictionaries with text and metadata

        Raises:
            Exception: If chunking fails
        """
        try:
            logger.info(f"Starting text chunking for asset {asset_id}")

            # Validate input
            if not text or not text.strip():
                raise ValueError("Text is empty or None")

            # Split text into chunks
            raw_chunks = self.text_splitter.split_text(text)

            if not raw_chunks:
                raise ValueError("Text splitter returned no chunks")

            # Process chunks and add metadata
            processed_chunks = []
            total_tokens = 0

            for i, chunk_text in enumerate(raw_chunks):
                # Count tokens for this chunk
                chunk_tokens = self.count_tokens(chunk_text)

                # Skip chunks that are too small (likely just whitespace/formatting)
                if chunk_tokens < 50:  # Very small threshold for meaningful content
                    logger.debug(
                        f"Skipping chunk {i} - too small ({chunk_tokens} tokens)"
                    )
                    continue

                # Create chunk metadata
                chunk_metadata = {
                    "chunk_id": f"{asset_id}_chunk_{i:03d}",
                    "chunk_index": i,
                    "chunk_tokens": chunk_tokens,
                    "asset_id": asset_id,
                    "source_filename": source_filename or "unknown",
                    "chunk_type": "text",
                    "processing_timestamp": self._get_timestamp(),
                }

                # Create chunk object
                chunk = {
                    "text": chunk_text.strip(),
                    "metadata": chunk_metadata,
                    "token_count": chunk_tokens,
                }

                processed_chunks.append(chunk)
                total_tokens += chunk_tokens

                # Safety check - prevent excessive chunks
                if len(processed_chunks) >= self.max_chunks_per_document:
                    logger.warning(
                        f"Reached maximum chunk limit ({self.max_chunks_per_document}) for asset {asset_id}"
                    )
                    break

            logger.info(
                f"Successfully created {len(processed_chunks)} chunks for asset {asset_id} ({total_tokens} total tokens)"
            )

            return processed_chunks

        except Exception as e:
            logger.error(f"Failed to chunk text for asset {asset_id}: {e!s}")
            raise Exception(f"Text chunking failed: {e!s}") from e

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using tiktoken.

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens
        """
        try:
            tokens = self.tokenizer.encode(text)
            return len(tokens)
        except Exception as e:
            logger.error(f"Token counting failed: {e!s}")
            return 0

    def estimate_chunks_needed(self, text: str) -> int:
        """
        Estimate how many chunks will be created from the given text.

        Args:
            text: Text to analyze

        Returns:
            Estimated number of chunks
        """
        total_tokens = self.count_tokens(text)
        if total_tokens <= self.chunk_size:
            return 1

        # Account for overlap reducing effective chunk size
        effective_chunk_size = self.chunk_size - self.chunk_overlap
        estimated_chunks = max(
            1, (total_tokens + effective_chunk_size - 1) // effective_chunk_size
        )

        return min(estimated_chunks, self.max_chunks_per_document)

    def validate_chunks(self, chunks: list[dict]) -> bool:
        """
        Validate that chunks are properly formatted.

        Args:
            chunks: List of chunk dictionaries to validate

        Returns:
            True if all chunks are valid
        """
        if not chunks:
            return False

        for i, chunk in enumerate(chunks):
            # Check required fields
            if not isinstance(chunk, dict):
                logger.error(f"Chunk {i} is not a dictionary")
                return False

            if "text" not in chunk or not chunk["text"]:
                logger.error(f"Chunk {i} missing or empty text")
                return False

            if "metadata" not in chunk or not isinstance(chunk["metadata"], dict):
                logger.error(f"Chunk {i} missing or invalid metadata")
                return False

            # Check metadata fields
            metadata = chunk["metadata"]
            required_fields = ["chunk_id", "chunk_index", "asset_id"]
            for field in required_fields:
                if field not in metadata:
                    logger.error(f"Chunk {i} metadata missing required field: {field}")
                    return False

        logger.info(f"All {len(chunks)} chunks passed validation")
        return True

    def get_chunking_stats(self, chunks: list[dict]) -> dict:
        """
        Generate statistics about the chunking process.

        Args:
            chunks: List of processed chunks

        Returns:
            Dictionary with chunking statistics
        """
        if not chunks:
            return {"error": "No chunks provided"}

        token_counts = [chunk.get("token_count", 0) for chunk in chunks]

        stats = {
            "total_chunks": len(chunks),
            "total_tokens": sum(token_counts),
            "avg_tokens_per_chunk": sum(token_counts) / len(chunks) if chunks else 0,
            "min_tokens": min(token_counts) if token_counts else 0,
            "max_tokens": max(token_counts) if token_counts else 0,
            "chunks_under_min_size": len(
                [t for t in token_counts if t < self.min_chunk_size]
            ),
            "chunks_over_max_size": len(
                [t for t in token_counts if t > self.chunk_size * 1.2]
            ),
        }

        return stats

    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata."""
        from datetime import datetime

        return datetime.utcnow().isoformat()
