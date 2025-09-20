"""
Logging middleware for request tracking and security.

This module provides middleware for adding request IDs,
security logging, and sanitized request logging.
"""

import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logger import logger


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for adding request IDs and security logging.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        
        # Add request ID to request state for access in endpoints
        request.state.request_id = request_id
        
        # Log request start (without sensitive data)
        start_time = time.time()
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Log sanitized request info
        logger.info(
            "[%s] Request started", request_id,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": client_ip,
                "user_agent": user_agent[:100],  # Truncate long user agents
            }
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Log successful response
            duration = time.time() - start_time
            logger.info(
                "[%s] Request completed", request_id,
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                }
            )
            
            # Add request ID to response headers for tracing
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log failed request
            duration = time.time() - start_time
            logger.error(
                "[%s] Request failed: %s", request_id, str(e),
                extra={
                    "request_id": request_id,
                    "error": str(e),
                    "duration_ms": round(duration * 1000, 2),
                }
            )
            raise

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address with proxy support.
        """
        # Check for forwarded headers (common in production)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP (original client)
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return getattr(request.client, "host", "unknown")


def get_request_id(request: Request) -> str:
    """
    Extract request ID from request state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Request ID string
    """
    return getattr(request.state, "request_id", "unknown")
