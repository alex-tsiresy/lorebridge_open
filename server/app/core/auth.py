"""
Centralized authentication configuration for LoreBridge application.

This module provides a single source of truth for Clerk authentication
configuration and utilities used across all endpoints.
"""

from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer
from app.core.config import settings

# Centralized Clerk configuration - single instance shared across all endpoints
clerk_config = ClerkConfig(jwks_url=settings.CLERK_JWKS_URL)
clerk_auth = ClerkHTTPBearer(config=clerk_config)

# Export for easy importing in endpoint files
__all__ = ["clerk_config", "clerk_auth"]
