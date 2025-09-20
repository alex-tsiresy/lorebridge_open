import asyncio
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.core.logger import logger


class FileStorageService:
    """Service for managing permanent file storage."""

    def __init__(self):
        # Ensure storage directory is absolute to avoid issues with working directory
        storage_path = Path(settings.STORAGE_DIR)
        if not storage_path.is_absolute():
            # Make it relative to the server directory
            self.storage_dir = Path(__file__).parent.parent.parent / storage_path
        else:
            self.storage_dir = storage_path
            
        self.max_file_size = (
            settings.MAX_FILE_SIZE_MB * 1024 * 1024
        )  # Convert MB to bytes
        # Process allowed extensions to remove dots for comparison
        self.allowed_extensions = [
            ext.strip().lower().lstrip(".")
            for ext in settings.ALLOWED_FILE_TYPES.split(",")
        ]

        # Create storage directory if it doesn't exist
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _validate_file(self, file: UploadFile) -> None:
        """Validate file type and size."""
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Check file extension
        file_ext = Path(file.filename).suffix.lower().lstrip(".")
        if file_ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Only PDF files are allowed. Received file type: '{file_ext}'",
            )

        # Check content type for PDF
        if file.content_type and not file.content_type.startswith("application/pdf"):
            raise HTTPException(
                status_code=400,
                detail="Invalid content type. Only PDF files are accepted.",
            )

    def _generate_storage_path(self, original_filename: str, asset_id: str) -> Path:
        """Generate a unique storage path for the file."""
        file_ext = Path(original_filename).suffix.lower()
        # Use asset_id as filename to avoid conflicts and make retrieval easy
        filename = f"{asset_id}{file_ext}"
        return self.storage_dir / filename

    async def store_file(self, file: UploadFile, asset_id: str) -> str:
        """
        Store an uploaded file permanently.

        Args:
            file: The uploaded file
            asset_id: The asset ID to use as the filename

        Returns:
            str: The relative path to the stored file
        """
        self._validate_file(file)

        # Generate storage path
        storage_path = self._generate_storage_path(file.filename, asset_id)

        try:
            # Read file content
            file_content = await file.read()

            # Check file size
            if len(file_content) > self.max_file_size:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size ({len(file_content)} bytes) exceeds maximum allowed size ({self.max_file_size} bytes)",
                )

            # Write file to storage using aiofiles for non-blocking I/O
            async with aiofiles.open(storage_path, "wb") as f:
                await f.write(file_content)

            relative_path = str(storage_path.relative_to(self.storage_dir))
            return relative_path

        except Exception as e:
            logger.error(f"Failed to store file {file.filename}: {e!s}")
            # Clean up partial file if it exists (use thread executor for file system ops)
            if await asyncio.to_thread(storage_path.exists):
                await asyncio.to_thread(storage_path.unlink)
            raise HTTPException(
                status_code=500, detail=f"Failed to store file: {e!s}"
            ) from e

    async def get_file_path(self, relative_path: str) -> Path | None:
        """Get the absolute path to a stored file using non-blocking file system operations."""
        
        if not relative_path:
            return None

        file_path = self.storage_dir / relative_path
        
        # Use asyncio.to_thread for non-blocking file system operations
        exists = await asyncio.to_thread(file_path.exists)
        is_file = await asyncio.to_thread(file_path.is_file) if exists else False
        
        if exists and is_file:
            return file_path

        return None

    async def delete_file(self, relative_path: str) -> bool:
        """Delete a stored file using non-blocking operations."""
        if not relative_path:
            return False

        file_path = self.storage_dir / relative_path
        try:
            exists = await asyncio.to_thread(file_path.exists)
            if exists:
                await asyncio.to_thread(file_path.unlink)
                logger.info(f"Deleted file: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e!s}")
            return False

    async def file_exists(self, relative_path: str) -> bool:
        """Check if a file exists in storage using non-blocking operations."""
        if not relative_path:
            return False

        file_path = self.storage_dir / relative_path
        exists = await asyncio.to_thread(file_path.exists)
        is_file = await asyncio.to_thread(file_path.is_file) if exists else False
        return exists and is_file


# Global instance
file_storage_service = FileStorageService()
