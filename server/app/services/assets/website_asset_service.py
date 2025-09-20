from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.asset import Asset, AssetStatus, AssetType
from app.services.content.firecrawl_service import FirecrawlService

from .base_asset_service import BaseAssetService


class WebsiteAssetService(BaseAssetService):
    """Specialized service for website asset processing."""

    def __init__(self):
        super().__init__()
        self.scraper = FirecrawlService()

    async def process_asset(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process website asset with web scraping."""
        try:
            self.log_processing_start(asset)

            # Scrape website content
            scrape_result = await self.scraper.scrape_website(asset.source)

            # Extract content
            asset.extracted_text = scrape_result.get("markdown", "")
            asset.summary = scrape_result.get("description", "")

            # Store metadata as JSON string
            import json
            asset.processing_metadata = json.dumps({
                "scraping": {
                    "url": asset.source,
                    "timestamp": datetime.utcnow().isoformat(),
                    "content_length": len(asset.extracted_text or ""),
                    "status": "completed",
                }
            })

            # Mark as completed
            self.update_status(asset, AssetStatus.completed, db)

            result = {
                "success": True,
                "asset_id": str(asset.id),
                "method": "website_scraping",
                "content_length": len(asset.extracted_text or ""),
                "has_summary": bool(asset.summary),
            }

            self.log_processing_success(asset, result)
            return result

        except Exception as e:
            self.log_processing_error(asset, e)
            self.update_status(asset, AssetStatus.failed, db)
            raise

    def validate_asset(self, asset: Asset) -> bool:
        """Validate website asset before processing."""
        return (
            asset.type == AssetType.website
            and asset.source is not None
            and asset.status == AssetStatus.processing
        )
