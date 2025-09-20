from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.asset import Asset, AssetStatus, AssetType

from .base_asset_service import BaseAssetService


class MediaAssetService(BaseAssetService):
    """Specialized service for video/audio asset processing."""

    def __init__(self):
        super().__init__()
        self.transcript_service_url = (
            settings.PYTHON_TRANSCRIPT_SERVICE_URL or "http://transcript-service:5001"
        )
        self.api_key = settings.PYTHON_TRANSCRIPT_SERVICE_API_KEY

    async def process_asset(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process media asset with external transcript service."""
        try:
            self.log_processing_start(asset)

            # Determine platform and call appropriate service
            if asset.type == AssetType.youtube:
                return await self._process_youtube(asset, db)
            elif asset.type == AssetType.instagram:
                return await self._process_instagram(asset, db)
            else:
                return await self._process_generic_media(asset, db)

        except Exception as e:
            self.log_processing_error(asset, e)
            self.update_status(asset, AssetStatus.failed, db)
            raise

    async def _process_youtube(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process YouTube video."""
        if not self.api_key:
            raise Exception("Python transcript service API key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.transcript_service_url}/transcript/youtube",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.api_key,
                },
                json={"url": asset.source},
                timeout=120.0,  # 2 minutes timeout
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("transcript", "")

                # Update asset with transcript
                asset.transcript = transcript
                self.update_status(asset, AssetStatus.completed, db)

                result = {
                    "success": True,
                    "asset_id": str(asset.id),
                    "method": "youtube_processing",
                    "transcript_length": len(transcript),
                }

                self.log_processing_success(asset, result)
                return result
            else:
                error_data = (
                    response.json()
                    if response.headers.get("content-type") == "application/json"
                    else {}
                )
                error_message = error_data.get("error", f"HTTP {response.status_code}")
                raise Exception(f"Transcript service error: {error_message}")

    async def _process_instagram(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process Instagram video."""
        if not self.api_key:
            raise Exception("Python transcript service API key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.transcript_service_url}/transcript/instagram",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.api_key,
                },
                json={"url": asset.source},
                timeout=120.0,
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("transcript", "")

                # Update asset with transcript
                asset.transcript = transcript
                self.update_status(asset, AssetStatus.completed, db)

                result = {
                    "success": True,
                    "asset_id": str(asset.id),
                    "method": "instagram_processing",
                    "transcript_length": len(transcript),
                }

                self.log_processing_success(asset, result)
                return result
            else:
                error_data = (
                    response.json()
                    if response.headers.get("content-type") == "application/json"
                    else {}
                )
                error_message = error_data.get("error", f"HTTP {response.status_code}")
                raise Exception(f"Transcript service error: {error_message}")

    async def _process_generic_media(self, asset: Asset, db: Session) -> dict[str, Any]:
        """Process generic media (video/audio)."""
        if not self.api_key:
            raise Exception("Python transcript service API key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.transcript_service_url}/transcript/generic",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.api_key,
                },
                json={"url": asset.source},
                timeout=120.0,
            )

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("transcript", "")

                # Update asset with transcript
                asset.transcript = transcript
                self.update_status(asset, AssetStatus.completed, db)

                result = {
                    "success": True,
                    "asset_id": str(asset.id),
                    "method": "generic_media_processing",
                    "transcript_length": len(transcript),
                }

                self.log_processing_success(asset, result)
                return result
            else:
                error_data = (
                    response.json()
                    if response.headers.get("content-type") == "application/json"
                    else {}
                )
                error_message = error_data.get("error", f"HTTP {response.status_code}")
                raise Exception(f"Transcript service error: {error_message}")

    def validate_asset(self, asset: Asset) -> bool:
        """Validate media asset before processing."""
        return (
            asset.type
            in [
                AssetType.youtube,
                AssetType.instagram,
                AssetType.video,
                AssetType.audio,
            ]
            and asset.source is not None
            and asset.status == AssetStatus.processing
        )
