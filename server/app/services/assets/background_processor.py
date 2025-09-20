import asyncio
import inspect
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.asset import Asset, AssetStatus
from app.services.assets.asset_service_factory import AssetServiceFactory

logger = logging.getLogger(__name__)


async def process_asset_async(
    asset_id: str, user_id: str, db: Session
) -> dict[str, Any]:
    """Process asset in background using the new service architecture."""
    from app.db.database import SessionLocal

    try:
        with SessionLocal() as session:
            # Get asset with user isolation
            asset = (
                session.query(Asset)
                .filter(
                    Asset.id == asset_id,
                    Asset.user_id == user_id,  # Security: user isolation
                )
                .first()
            )

            if not asset:
                logger.error(f"Asset {asset_id} not found for user {user_id}")
                return {"success": False, "error": "Asset not found"}

            # Get appropriate service
            factory = AssetServiceFactory()
            service = factory.get_service(asset.type)

            # Validate asset before processing
            if not service.validate_asset(asset):
                logger.error(f"Asset {asset_id} validation failed")
                await service.update_status_async(asset, AssetStatus.failed, session)
                return {"success": False, "error": "Asset validation failed"}

            # Process asset (handle both sync and async services)
            try:
                # Check if the service's process_asset method is async
                if inspect.iscoroutinefunction(service.process_asset):
                    # Async service
                    result = await service.process_asset(asset, session)
                else:
                    # Sync service
                    result = service.process_asset(asset, session)

                logger.info(f"Asset {asset_id} processed successfully: {result}")
                return result
            except Exception as e:
                logger.error(f"Asset {asset_id} processing failed: {e}")
                await service.update_status_async(asset, AssetStatus.failed, session)
                return {"success": False, "error": str(e)}

    except Exception as e:
        logger.error(f"Background processing failed for asset {asset_id}: {e}")
        return {"success": False, "error": str(e)}


def process_asset_sync(asset_id: str, user_id: str, db: Session) -> dict[str, Any]:
    """Synchronous wrapper for asset processing."""
    return asyncio.run(process_asset_async(asset_id, user_id, db))


async def process_multiple_assets_async(
    asset_ids: list[str], user_id: str, db: Session
) -> list[dict[str, Any]]:
    """Process multiple assets concurrently."""
    tasks = []
    for asset_id in asset_ids:
        task = process_asset_async(asset_id, user_id, db)
        tasks.append(task)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Convert exceptions to error results
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append(
                {"success": False, "asset_id": asset_ids[i], "error": str(result)}
            )
        else:
            processed_results.append(result)

    return processed_results
