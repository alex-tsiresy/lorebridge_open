"""
Service interface contracts for LoreBridge application.

This module defines abstract base classes that establish clear contracts
for different service types, improving modularity and testability.
"""

from abc import ABC, abstractmethod
from collections.abc import Generator
from typing import Any

from pydantic import BaseModel


class AIProviderInterface(ABC):
    """Interface contract for AI/LLM providers."""

    @abstractmethod
    def chat(self, messages: list[dict[str, str]], **kwargs) -> str:
        """Generate a chat completion."""
        pass

    @abstractmethod
    def chat_stream(
        self, messages: list[dict[str, str]], **kwargs
    ) -> Generator[str, None, None]:
        """Generate a streaming chat completion."""
        pass

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        """Generate embeddings for text."""
        pass


class DocumentProcessorInterface(ABC):
    """Interface contract for document processing services."""

    @abstractmethod
    def extract_text(self, file_path: str) -> str:
        """Extract text content from a document."""
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        pass

    @abstractmethod
    def classify_document_type(self, text: str) -> str:
        """Classify the type of document."""
        pass


class VectorStoreInterface(ABC):
    """Interface contract for vector database operations."""

    @abstractmethod
    def store_embeddings(
        self, collection_id: str, embeddings: list[dict[str, Any]]
    ) -> bool:
        """Store embeddings in the vector database."""
        pass

    @abstractmethod
    def semantic_search(
        self, collection_id: str, query_embedding: list[float], top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Perform semantic search in the vector database."""
        pass

    @abstractmethod
    def create_collection(self, collection_id: str, metadata: dict[str, Any]) -> str:
        """Create a new collection in the vector database."""
        pass


class ExportServiceInterface(ABC):
    """Interface contract for export services."""

    @abstractmethod
    def export_data(self, data: Any, format_type: str) -> str:
        """Export data to specified format."""
        pass

    @abstractmethod
    def validate_export_format(self, format_type: str) -> bool:
        """Validate if export format is supported."""
        pass


class PaymentProviderInterface(ABC):
    """Interface contract for payment providers."""

    @abstractmethod
    def create_checkout_session(
        self, customer_id: str, price_id: str
    ) -> dict[str, str]:
        """Create a checkout session."""
        pass

    @abstractmethod
    def handle_webhook_event(self, event_data: dict[str, Any]) -> bool:
        """Process webhook events."""
        pass

    @abstractmethod
    def get_subscription_status(self, customer_id: str) -> dict[str, Any]:
        """Get customer subscription status."""
        pass


class ContentScrapingInterface(ABC):
    """Interface contract for web content scraping services."""

    @abstractmethod
    def scrape_website(self, url: str) -> dict[str, Any]:
        """Scrape content from a website."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the scraping service is available."""
        pass


# Response Models for better type safety
class ServiceResponse(BaseModel):
    """Base response model for service operations."""

    success: bool
    message: str | None = None
    data: Any | None = None
    error: str | None = None


class ProcessingResult(BaseModel):
    """Result model for processing operations."""

    success: bool
    result_id: str
    metadata: dict[str, Any]
    processing_time_ms: int | None = None
    error: str | None = None
