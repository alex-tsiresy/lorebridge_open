"""
Rate limiting utilities for LoreBridge application.

This module provides rate limiting functionality to protect against abuse.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

# Create a limiter instance
limiter = Limiter(key_func=get_remote_address)

def rate_limit_exceeded_handler(_request: Request, exc: RateLimitExceeded):
    """
    Custom rate limit exceeded handler that returns a JSON response.
    """
    response = JSONResponse(
        status_code=429,
        content={
            "error": True,
            "error_code": "RATE_LIMIT_EXCEEDED",
            "message": "Too many requests. Please try again later.",
            "retry_after": exc.retry_after
        }
    )
    response.headers["Retry-After"] = str(exc.retry_after)
    return response

# Rate limiting decorators for different endpoint types
UPLOAD_RATE_LIMIT = "5/minute"    # 5 uploads per minute
CHAT_RATE_LIMIT = "30/minute"     # 30 chat messages per minute
API_RATE_LIMIT = "100/minute"     # 100 general API calls per minute
CREATE_RATE_LIMIT = "20/minute"   # 20 create operations per minute
READ_RATE_LIMIT = "200/minute"    # 200 read operations per minute
WEBHOOK_RATE_LIMIT = "10/minute"  # 10 webhook calls per minute
PROCESSING_RATE_LIMIT = "10/minute"  # 10 processing operations per minute
