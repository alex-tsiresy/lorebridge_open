"""
Authentication decorators for standardizing authorization patterns.

This module provides decorators and utilities for consistent 
authentication and authorization across all endpoints.
"""

import asyncio
from functools import wraps
from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.auth import clerk_auth  # Import from centralized auth module
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User as DBUser


def require_auth():
    """
    Standard authentication dependency that returns the current user.
    Use this instead of manually handling clerk_auth and get_current_user.
    
    Usage:
        def my_endpoint(current_user: DBUser = Depends(require_auth())):
            # current_user is guaranteed to be authenticated
    """
    def _get_authenticated_user(
        db: Session = Depends(get_db),
        credentials: HTTPAuthorizationCredentials = Depends(clerk_auth),
    ) -> DBUser:
        return get_current_user(db=db, credentials=credentials)
    
    return _get_authenticated_user


def require_user_match(user_id_param: str = "clerk_user_id"):
    """
    Decorator that ensures the authenticated user matches the user ID in the path.
    
    Args:
        user_id_param: Name of the parameter containing the user ID to check
        
    Usage:
        @require_user_match("clerk_user_id")
        def get_user_data(
            clerk_user_id: str, 
            current_user: DBUser = Depends(require_auth())
        ):
            # Automatically verified that current_user.clerk_user_id == clerk_user_id
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract the user ID from kwargs
            path_user_id = kwargs.get(user_id_param)
            current_user = None
            
            # Find the current_user in kwargs (should be injected by require_auth dependency)
            for value in kwargs.values():
                if isinstance(value, DBUser):
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=500, 
                    detail="Authentication dependency not properly configured"
                )
            
            if path_user_id and current_user.clerk_user_id != path_user_id:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to access this user's data"
                )
            
            return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        return wrapper
    return decorator
