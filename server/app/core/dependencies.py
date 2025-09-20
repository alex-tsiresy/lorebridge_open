from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.db.database import get_db
from app.models.user import User as DBUser

# Standard Clerk configuration
clerk_config = ClerkConfig(jwks_url=settings.CLERK_JWKS_URL)
clerk_auth_dep = ClerkHTTPBearer(config=clerk_config)


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_dep),
) -> DBUser:
    logger.debug(f"JWT credentials received: scheme='{credentials.scheme}' credentials='***'")
    logger.debug(f"JWT decoded payload: {credentials.decoded}")
    clerk_user_id = credentials.decoded["sub"]
    user = db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
    if user is None:
        logger.info(
            f"User with clerk_id {clerk_user_id} not found. Creating a new user."
        )
        # This logic is based on the `/users/me` endpoint.
        # If a user is authenticated but not in our DB, we create them.
        try:
            user = DBUser(
                clerk_user_id=clerk_user_id,
                subscription_status="free",
                subscription_cancel_at_period_end=False,
                has_used_trial=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"Successfully created user with clerk_id: {clerk_user_id}")
        except Exception as e:
            logger.error(
                f"Failed to create user with clerk_id: {clerk_user_id}, error: {e}"
            )
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not create user.") from e
    else:
        # Sanitize legacy users that may predate subscription fields or have NULLs
        updated = False
        if user.subscription_status is None:
            user.subscription_status = "free"
            updated = True
        if user.subscription_cancel_at_period_end is None:
            user.subscription_cancel_at_period_end = False
            updated = True
        if user.has_used_trial is None:
            user.has_used_trial = False
            updated = True

        # Persist any changes to ensure future responses are valid
        if updated:
            try:
                db.commit()
                db.refresh(user)
                logger.info(
                    f"Updated legacy subscription fields for user with clerk_id: {clerk_user_id}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to update legacy subscription fields for user {clerk_user_id}: {e}"
                )
                db.rollback()
    return user
