import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.asset import Asset, AssetStatus


class BaseAssetService(ABC):
    """Base class for all asset processing services."""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def process_asset(self, asset: Asset, db: Session) -> dict[str, Any] | Any:
        """Process an asset and return results. Can be sync or async."""
        pass

    @abstractmethod
    def validate_asset(self, asset: Asset) -> bool:
        """Validate asset before processing."""
        pass

    def update_status(self, asset: Asset, status: AssetStatus, db: Session) -> None:
        """Synchronously update asset status with logging."""
        asset.status = status
        db.commit()
        self.logger.info(f"Updated asset {asset.id} status to {status}")

    async def update_status_async(
        self, asset: Asset, status: AssetStatus, db: Session
    ) -> None:
        """Asynchronously update asset status without blocking the event loop."""
        asset.status = status
        await asyncio.to_thread(db.commit)
        self.logger.info(f"Updated asset {asset.id} status to {status}")

    def log_processing_start(self, asset: Asset) -> None:
        """Log the start of asset processing."""
        self.logger.info(
            f"Starting processing for asset {asset.id} (type: {asset.type})"
        )

    def log_processing_success(self, asset: Asset, result: dict[str, Any]) -> None:
        """Log successful asset processing."""
        self.logger.info(f"Successfully processed asset {asset.id}: {result}")

    def log_processing_error(self, asset: Asset, error: Exception) -> None:
        """Log asset processing error."""
        self.logger.error(f"Failed to process asset {asset.id}: {error}")
