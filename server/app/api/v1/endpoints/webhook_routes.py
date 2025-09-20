import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limiter import limiter, WEBHOOK_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser

router = APIRouter()


def verify_webhook_signature(
    payload: bytes, signature: str, webhook_secret: str
) -> bool:
    """Verify Clerk webhook signature"""
    if not webhook_secret:
        logger.error("Webhook secret not configured - rejecting webhook request")
        raise HTTPException(
            status_code=500, 
            detail="Webhook authentication not properly configured"
        )

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected_signature}", signature)


@router.post("/clerk")
@limiter.limit(WEBHOOK_RATE_LIMIT)
async def clerk_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Clerk webhook events"""

    # Get the raw payload
    payload = await request.body()
    logger.info(f"Received Clerk webhook: payload={payload}")

    # Get signature from headers
    signature = request.headers.get("svix-signature", "")

    # Verify signature (required for security)
    webhook_secret = settings.CLERK_WEBHOOK_SECRET
    if not verify_webhook_signature(payload, signature, webhook_secret):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Parse the JSON payload
    try:
        event_data = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from None

    event_type = event_data.get("type")
    user_data = event_data.get("data", {})

    if event_type == "user.created":
        await handle_user_created(user_data, db)
    elif event_type == "user.updated":
        await handle_user_updated(user_data, db)
    elif event_type == "user.deleted":
        await handle_user_deleted(user_data, db)

    return {"message": "Webhook processed successfully"}


async def handle_user_created(user_data: dict, db: Session):
    """Handle user creation from Clerk"""
    clerk_user_id = user_data.get("id")
    if not clerk_user_id:
        logger.error("No clerk_user_id in user_data during webhook user.created event")
        return

    # Check if user already exists
    existing_user = (
        db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
    )
    if existing_user:
        logger.info(f"User already exists in webhook: {clerk_user_id}")
        return  # User already exists

    try:
        # Create new user with simplified model
        new_user = DBUser(clerk_user_id=clerk_user_id)

        db.add(new_user)
        db.commit()
        logger.info(f"Created user in webhook: {clerk_user_id}")
    except Exception as e:
        logger.error(f"Failed to create user in webhook: {clerk_user_id}, error: {e}")


async def handle_user_updated(user_data: dict, db: Session):
    """Handle user updates from Clerk"""
    clerk_user_id = user_data.get("id")
    if not clerk_user_id:
        return

    # Find existing user
    user = db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
    if not user:
        # If user doesn't exist, create them
        await handle_user_created(user_data, db)
        return

    # For simplified model, there's nothing to update except potentially is_active
    # You could add logic here to handle account status changes if needed
    db.commit()


async def handle_user_deleted(user_data: dict, db: Session):
    """Handle user deletion from Clerk"""
    clerk_user_id = user_data.get("id")
    if not clerk_user_id:
        return

    # Find and delete user
    user = db.query(DBUser).filter(DBUser.clerk_user_id == clerk_user_id).first()
    if user:
        db.delete(user)
        db.commit()
