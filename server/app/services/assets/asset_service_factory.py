from app.db.models.asset import AssetType

from .base_asset_service import BaseAssetService
from .media_asset_service import MediaAssetService
from .pdf_asset_service import PDFAssetService
from .website_asset_service import WebsiteAssetService


class AssetServiceFactory:
    """Factory for creating appropriate asset services."""

    def __init__(self):
        self._services: dict[AssetType, type[BaseAssetService]] = {
            AssetType.pdf: PDFAssetService,
            AssetType.youtube: MediaAssetService,
            AssetType.instagram: MediaAssetService,
            AssetType.video: MediaAssetService,
            AssetType.audio: MediaAssetService,
            AssetType.website: WebsiteAssetService,
        }

    def get_service(self, asset_type: AssetType) -> BaseAssetService:
        """Get the appropriate service for an asset type."""
        service_class = self._services.get(asset_type)
        if not service_class:
            raise ValueError(f"No service found for asset type: {asset_type}")

        return service_class()

    def can_process(self, asset_type: AssetType) -> bool:
        """Check if we can process this asset type."""
        return asset_type in self._services

    def get_supported_types(self) -> list[AssetType]:
        """Get list of supported asset types."""
        return list(self._services.keys())

    def register_service(
        self, asset_type: AssetType, service_class: type[BaseAssetService]
    ) -> None:
        """Register a new service for an asset type."""
        self._services[asset_type] = service_class
