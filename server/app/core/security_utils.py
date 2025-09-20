"""
Security utilities for LoreBridge application.

This module provides utilities for secure error handling, 
input validation, and other security-related functions.
"""

import re
import uuid
from fastapi import Request

from app.core.logger import logger


class SecurityUtils:
    """Utility class for security-related operations."""

    @staticmethod
    def sanitize_error_message(error: Exception, request: Request | None = None) -> str:
        """
        Sanitize error messages to prevent information disclosure.
        
        Args:
            error: The original exception
            request: Optional request object for correlation in logs
            
        Returns:
            User-friendly error message
        """
        # Extract request ID from request state if available
        request_id = getattr(request.state, "request_id", "unknown") if request else "unknown"
        
        # Log full details internally with request ID
        logger.error("Internal error: %s", error, extra={"request_id": request_id})
        
        error_str = str(error).lower()
        
        # Database-related errors
        if any(keyword in error_str for keyword in ["sql", "database", "connection", "psycopg"]):
            return "A database error occurred. Please try again later."
        
        # File system errors
        if any(keyword in error_str for keyword in ["permission denied", "file not found", "disk"]):
            return "A file system error occurred. Please try again later."
        
        # Network/external service errors
        if any(keyword in error_str for keyword in ["timeout", "connection", "network", "api"]):
            return "A network error occurred. Please check your connection and try again."
        
        # Authentication/authorization errors
        if any(keyword in error_str for keyword in ["unauthorized", "forbidden", "token", "auth"]):
            return "Authentication error. Please sign in again."
        
        # Validation errors (these can be more specific as they're user-facing)
        if any(keyword in error_str for keyword in ["validation", "invalid", "required"]):
            # Return validation errors as-is since they're meant for users
            return str(error)
        
        # Generic fallback for all other errors
        return "An unexpected error occurred. Please try again or contact support if the problem persists."

    @staticmethod
    def generate_request_id() -> str:
        """Generate a unique request ID for tracking."""
        return str(uuid.uuid4())[:8]

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize uploaded filenames to prevent path traversal attacks.
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
        """
        if not filename:
            return "upload"
        
        # Remove directory traversal attempts
        filename = filename.replace("../", "").replace("..\\", "")
        
        # Keep only alphanumeric, dots, hyphens, and underscores
        filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        
        # Limit length
        if len(filename) > 255:
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            filename = name[:250 - len(ext)] + ('.' + ext if ext else '')
        
        return filename

    @staticmethod
    def validate_file_type(content_type: str, allowed_types: list[str]) -> bool:
        """
        Validate file content type against allowed types.
        
        Args:
            content_type: MIME type of the uploaded file
            allowed_types: List of allowed MIME types
            
        Returns:
            True if file type is allowed
        """
        return content_type in allowed_types

    @staticmethod
    def validate_file_size(file_size: int, max_size_mb: int) -> bool:
        """
        Validate file size against maximum allowed size.
        
        Args:
            file_size: Size of the file in bytes
            max_size_mb: Maximum allowed size in MB
            
        Returns:
            True if file size is within limits
        """
        max_size_bytes = max_size_mb * 1024 * 1024
        return file_size <= max_size_bytes
