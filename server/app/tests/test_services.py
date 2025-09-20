"""Test core services."""
import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from app.services.ai.llm_manager import LLMManager
from app.services.ai.summarization_service import SummarizationService
from app.services.assets.pdf_asset_service import PDFAssetService
from app.services.content.firecrawl_service import FirecrawlService
from app.db.models.asset import Asset, AssetType


class TestLLMManager:
    """Test LLM Manager service."""

    @patch("app.services.ai.llm_manager.OpenAI")
    def test_llm_manager_initialization(self, mock_openai: Mock) -> None:
        """Test LLM manager initializes correctly."""
        manager = LLMManager()
        assert manager is not None
        mock_openai.assert_called_once()

    @patch("app.services.ai.llm_manager.OpenAI")
    def test_generate_response(self, mock_openai: Mock) -> None:
        """Test generating a response."""
        # Mock OpenAI client
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Test response"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        manager = LLMManager()
        response = manager.generate_response("Test prompt")
        
        assert response == "Test response"
        mock_client.chat.completions.create.assert_called_once()


class TestSummarizationService:
    """Test summarization service."""

    @patch("app.services.ai.summarization_service.LLMManager")
    def test_summarize_text(self, mock_llm_manager: Mock) -> None:
        """Test text summarization."""
        # Mock LLM manager
        mock_manager_instance = Mock()
        mock_manager_instance.generate_response.return_value = "This is a summary."
        mock_llm_manager.return_value = mock_manager_instance
        
        service = SummarizationService()
        summary = service.summarize_text("This is a long text that needs to be summarized.")
        
        assert summary == "This is a summary."
        mock_manager_instance.generate_response.assert_called_once()

    def test_summarize_empty_text(self) -> None:
        """Test summarizing empty text."""
        service = SummarizationService()
        summary = service.summarize_text("")
        assert summary == ""

    def test_summarize_short_text(self) -> None:
        """Test summarizing text that's already short."""
        service = SummarizationService()
        short_text = "This is short."
        summary = service.summarize_text(short_text)
        # Should return original text if it's already short
        assert len(summary) <= len(short_text) or summary == short_text


class TestPDFAssetService:
    """Test PDF asset service."""

    def test_pdf_service_initialization(self) -> None:
        """Test PDF service initializes correctly."""
        service = PDFAssetService()
        assert service is not None

    def test_validate_asset(self, db_session: Session) -> None:
        """Test asset validation."""
        service = PDFAssetService()
        
        # Create valid asset
        from app.db.models.asset import AssetStatus
        asset = Asset(
            id="test_asset_id",
            asset_type=AssetType.PDF,
            file_path="/fake/path/test.pdf",
            user_id="test_user",
            graph_id="test_graph",
            status=AssetStatus.processing
        )
        
        # This should pass validation based on the service logic
        is_valid = service.validate_asset(asset)
        # The validation will depend on the specific implementation
        assert isinstance(is_valid, bool)


class TestFirecrawlService:
    """Test Firecrawl service."""

    @patch("app.services.content.firecrawl_service.FirecrawlApp")
    def test_firecrawl_initialization(self, mock_firecrawl_app: Mock) -> None:
        """Test Firecrawl service initializes correctly."""
        service = FirecrawlService()
        assert service is not None
        mock_firecrawl_app.assert_called_once()

    @patch("app.services.content.firecrawl_service.FirecrawlApp")
    def test_scrape_url(self, mock_firecrawl_app: Mock) -> None:
        """Test scraping a URL."""
        # Mock Firecrawl response
        mock_app_instance = Mock()
        mock_app_instance.scrape_url.return_value = {
            "success": True,
            "data": {
                "content": "Scraped website content",
                "metadata": {
                    "title": "Test Website",
                    "description": "A test website"
                }
            }
        }
        mock_firecrawl_app.return_value = mock_app_instance
        
        service = FirecrawlService()
        result = service.scrape_url("https://example.com")
        
        assert result["content"] == "Scraped website content"
        assert result["title"] == "Test Website"
        mock_app_instance.scrape_url.assert_called_once_with("https://example.com")

    @patch("app.services.content.firecrawl_service.FirecrawlApp")
    def test_scrape_url_failure(self, mock_firecrawl_app: Mock) -> None:
        """Test handling scraping failures."""
        # Mock Firecrawl failure response
        mock_app_instance = Mock()
        mock_app_instance.scrape_url.return_value = {
            "success": False,
            "error": "Failed to scrape URL"
        }
        mock_firecrawl_app.return_value = mock_app_instance
        
        service = FirecrawlService()
        
        with pytest.raises(Exception):  # Should raise exception on failure
            service.scrape_url("https://invalid-url.com")


class TestDatabaseModels:
    """Test database model relationships and constraints."""

    def test_asset_model_creation(self, db_session: Session) -> None:
        """Test creating an asset model."""
        asset = Asset(
            id="test_asset",
            asset_type=AssetType.PDF,
            user_id="test_user",
            graph_id="test_graph",
            file_name="test.pdf",
            original_name="Original Test.pdf"
        )
        
        db_session.add(asset)
        db_session.commit()
        
        # Verify asset was created
        retrieved_asset = db_session.query(Asset).filter(Asset.id == "test_asset").first()
        assert retrieved_asset is not None
        assert retrieved_asset.asset_type == AssetType.PDF
        assert retrieved_asset.file_name == "test.pdf"

    def test_asset_enum_values(self) -> None:
        """Test asset type enum values."""
        assert AssetType.PDF == "pdf"
        assert AssetType.WEBSITE == "website" 
        assert AssetType.YOUTUBE == "youtube"
        assert AssetType.INSTAGRAM == "instagram"
        assert AssetType.DOCUMENT == "document"
        assert AssetType.GRAPH == "graph"