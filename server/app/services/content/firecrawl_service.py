"""
Firecrawl Web Scraping Service

This service handles website scraping using the Firecrawl API.
It extracts clean, LLM-ready content from websites.
"""

from typing import Any

from firecrawl import Firecrawl

from app.core.config import settings
from app.core.logger import logger
from app.services.metrics import CRAWL_JOBS_SECONDS, CRAWL_JOB_ERRORS


class FirecrawlService:
    """Service for scraping websites using Firecrawl API"""

    def __init__(self):
        """Initialize Firecrawl service with API key"""
        if not settings.FIRECRAWL_API_KEY:
            logger.warning(
                "FIRECRAWL_API_KEY not set. Firecrawl functionality will be disabled."
            )
            self.app = None
        else:
            try:
                self.app = Firecrawl(api_key=settings.FIRECRAWL_API_KEY)
                logger.info("Firecrawl service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Firecrawl: {e}")
                self.app = None

    def is_available(self) -> bool:
        """Check if Firecrawl service is available"""
        return self.app is not None

    async def scrape_website(self, url: str) -> dict[str, Any] | None:
        """
        Scrape a website and return clean content

        Args:
            url: The website URL to scrape

        Returns:
            Dictionary containing scraped data or None if failed
            Format:
            {
                'markdown': 'Clean markdown content',
                'title': 'Page title',
                'description': 'Page description',
                'metadata': {...},
                'success': True/False,
                'error': 'Error message if failed'
            }
        """
        if not self.is_available():
            logger.error("Firecrawl service not available")
            return {"success": False, "error": "Firecrawl service not configured"}

        try:
            import time
            start_time = time.time()
            logger.info(f"Starting to scrape website: {url}")
            logger.info(f"Firecrawl service status: available={self.is_available()}")
            logger.info(f"Firecrawl app instance: {type(self.app)}")
            logger.info(f"Firecrawl app methods: {[m for m in dir(self.app) if 'scrape' in m.lower()]}")

            # Scrape the website with markdown and metadata
            logger.info("Calling Firecrawl API with parameters:")
            logger.info(f"  - URL: {url}")
            logger.info("  - formats: ['markdown', 'html']")

            if not hasattr(self.app, 'scrape'):
                logger.error(f"Firecrawl app does not have scrape method. Available methods: {dir(self.app)}")
                return {"success": False, "error": "Firecrawl scrape method not available"}

            scrape_result = self.app.scrape(
                url,
                formats=["markdown", "html"]
            )

            logger.info(f"Firecrawl API response type: {type(scrape_result)}")
            # API response content logging removed for security

            if not scrape_result:
                logger.error(f"Firecrawl returned None/empty response for {url}")
                return {"success": False, "error": "Firecrawl returned empty response"}

            # Handle new SDK response format
            # The new SDK returns a document object directly with markdown and metadata
            if isinstance(scrape_result, dict):
                markdown_content = scrape_result.get("markdown", "")
                html_content = scrape_result.get("html", "")
                metadata = scrape_result.get("metadata", {})
                
                logger.info("Using dictionary response format")
                logger.info(
                    f"Content lengths - markdown: {len(markdown_content)} chars, html: {len(html_content)} chars"
                )
            else:
                # Handle object response format
                markdown_content = getattr(scrape_result, "markdown", "") or ""
                html_content = getattr(scrape_result, "html", "") or ""
                metadata = getattr(scrape_result, "metadata", {}) or {}

                logger.info("Using object response format")
                logger.info(
                    f"Content lengths - markdown: {len(markdown_content)} chars, html: {len(html_content)} chars"
                )

            logger.info(
                f"Final metadata keys: {list(metadata.keys()) if isinstance(metadata, dict) else 'metadata is not dict'}"
            )

            # Extract the key information
            # Handle both dictionary and Pydantic model metadata
            def safe_get_metadata(metadata_obj, key: str, default: Any = ""):
                """Safely get metadata field from either dict or Pydantic model"""
                if isinstance(metadata_obj, dict):
                    return metadata_obj.get(key, default)
                else:
                    # Pydantic model - use getattr
                    return getattr(metadata_obj, key, default)
            
            result = {
                "success": True,
                "markdown": markdown_content,
                "html": html_content,
                "title": safe_get_metadata(metadata, "title", ""),
                "description": safe_get_metadata(metadata, "description", ""),
                "language": safe_get_metadata(metadata, "language", "en"),
                "keywords": safe_get_metadata(metadata, "keywords", ""),
                "metadata": metadata if isinstance(metadata, dict) else (metadata.model_dump() if hasattr(metadata, 'model_dump') else dict(metadata)) if metadata else {},
                "source_url": url,
            }

            logger.info(
                f"Successfully scraped {url}. Final result keys: {list(result.keys())}"
            )
            logger.info(f"Content length: {len(result['markdown'])} chars")
            # Title and description logging removed for security

            CRAWL_JOBS_SECONDS.labels("success").observe(time.time() - start_time)
            return result

        except Exception as e:
            logger.error(f"Exception during website scraping for {url}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Exception message: {e!s}")
            logger.error(f"Exception args: {e.args}")
            import traceback

            logger.error(f"Exception traceback: {traceback.format_exc()}")

            CRAWL_JOB_ERRORS.labels(type(e).__name__).inc()
            try:
                import time as _t
                CRAWL_JOBS_SECONDS.labels("error").observe(_t.time() - start_time)  # type: ignore[name-defined]
            except Exception:
                pass
            return {"success": False, "error": f"Scraping failed: {e!s}"}

    async def scrape_with_structured_data(
        self, url: str, schema: dict | None = None
    ) -> dict[str, Any] | None:
        """
        Scrape a website and extract structured data

        Args:
            url: The website URL to scrape
            schema: Optional Pydantic schema for structured extraction

        Returns:
            Dictionary containing scraped and structured data
        """
        if not self.is_available():
            return {"success": False, "error": "Firecrawl service not configured"}

        try:
            logger.info(f"Starting structured scrape of website: {url}")

            # First get the basic scrape
            basic_result = await self.scrape_website(url)
            if not basic_result["success"]:
                return basic_result

            # If schema is provided, do structured extraction
            if schema:
                try:
                    # For structured data extraction with the new SDK
                    # This feature may need to be implemented differently in the new version
                    logger.warning(f"Structured extraction with schema not yet implemented for new SDK version")
                    # Continue without structured data

                except Exception as e:
                    logger.warning(f"Structured extraction failed for {url}: {e}")
                    # Continue without structured data

            return basic_result

        except Exception as e:
            logger.error(f"Failed structured scrape of {url}: {e!s}")
            return {"success": False, "error": f"Structured scraping failed: {e!s}"}


# Global service instance
firecrawl_service = FirecrawlService()
