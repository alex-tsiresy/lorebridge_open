from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_decorators import require_auth
from app.core.logger import logger
from app.core.rate_limiter import limiter, CREATE_RATE_LIMIT, READ_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser
from app.services.payment.stripe_service import stripe_service

router = APIRouter()


# Pydantic schemas for request/response
class CheckoutSessionRequest(BaseModel):
    success_url: str
    cancel_url: str
    with_trial: bool = True


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str
    has_trial: bool


class CustomerPortalRequest(BaseModel):
    return_url: str


class CustomerPortalResponse(BaseModel):
    url: str


class SubscriptionStatusResponse(BaseModel):
    subscription_status: str
    stripe_customer_id: str | None
    subscription_id: str | None
    subscription_current_period_end: str | None
    subscription_cancel_at_period_end: bool
    trial_end_date: str | None
    has_used_trial: bool


class TrialEligibilityResponse(BaseModel):
    eligible: bool
    reason: str | None


# Authentication handled by centralized require_auth decorator


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
@limiter.limit(CREATE_RATE_LIMIT)
async def create_checkout_session(
    request: Request,
    req: CheckoutSessionRequest,
    current_user: DBUser = Depends(require_auth()),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe checkout session for subscription with optional 7-day trial
    """
    try:
        # Ensure user has a Stripe customer ID
        if not current_user.stripe_customer_id:
            # We need user's email from Clerk - for now, we'll use a placeholder
            # In production, you'd get this from Clerk's user data
            customer_id = await stripe_service.create_customer(
                current_user,
                email=f"user-{current_user.clerk_user_id}@example.com",  # Placeholder
            )
            current_user.stripe_customer_id = customer_id
            db.commit()

        # Check if trial will be included
        has_trial = req.with_trial and stripe_service.check_trial_eligibility(
            current_user
        )

        # Create checkout session
        session_data = await stripe_service.create_checkout_session(
            user=current_user,
            customer_id=current_user.stripe_customer_id,
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            with_trial=req.with_trial,
        )

        logger.info(f"Created checkout session for user {current_user.id}")

        return CheckoutSessionResponse(
            session_id=session_data["session_id"],
            url=session_data["url"],
            has_trial=has_trial,
        )

    except Exception as e:
        logger.error(f"Failed to create checkout session: {e!s}")
        raise HTTPException(
            status_code=500, detail="Failed to create checkout session"
        ) from e


@router.post("/portal", response_model=CustomerPortalResponse)
@limiter.limit(CREATE_RATE_LIMIT)
async def create_customer_portal_session(
    request: Request,
    req: CustomerPortalRequest, 
    current_user: DBUser = Depends(require_auth()),
):
    """
    Create a customer portal session for subscription management
    """
    try:
        if not current_user.stripe_customer_id:
            raise HTTPException(
                status_code=400, detail="User has no Stripe customer ID"
            )

        portal_url = await stripe_service.create_customer_portal_session(
            customer_id=current_user.stripe_customer_id, return_url=req.return_url
        )

        logger.info(f"Created customer portal session for user {current_user.id}")

        return CustomerPortalResponse(url=portal_url)

    except Exception as e:
        logger.error(f"Failed to create customer portal session: {e!s}")
        raise HTTPException(
            status_code=500, detail="Failed to create customer portal session"
        ) from e


@router.get("/status", response_model=SubscriptionStatusResponse)
@limiter.limit(READ_RATE_LIMIT)
def get_subscription_status(
    request: Request,
    current_user: DBUser = Depends(require_auth()),
):
    """
    Get current user's subscription status
    """
    try:
        return SubscriptionStatusResponse(
            subscription_status=current_user.subscription_status,
            stripe_customer_id=current_user.stripe_customer_id,
            subscription_id=current_user.subscription_id,
            subscription_current_period_end=(
                current_user.subscription_current_period_end.isoformat()
                if current_user.subscription_current_period_end
                else None
            ),
            subscription_cancel_at_period_end=current_user.subscription_cancel_at_period_end,
            trial_end_date=(
                current_user.trial_end_date.isoformat()
                if current_user.trial_end_date
                else None
            ),
            has_used_trial=current_user.has_used_trial,
        )

    except Exception as e:
        logger.error(f"Failed to get subscription status: {e!s}")
        raise HTTPException(
            status_code=500, detail="Failed to get subscription status"
        ) from e


@router.get("/trial-eligibility", response_model=TrialEligibilityResponse)
@limiter.limit(READ_RATE_LIMIT)
def check_trial_eligibility(
    request: Request,
    current_user: DBUser = Depends(require_auth()),
):
    """
    Check if user is eligible for free trial
    """
    try:
        eligible = stripe_service.check_trial_eligibility(current_user)

        reason = None
        if not eligible:
            if current_user.has_used_trial:
                reason = "User has already used their free trial"
            elif current_user.subscription_status != "free":
                reason = f"User is currently on {current_user.subscription_status} plan"

        return TrialEligibilityResponse(eligible=eligible, reason=reason)

    except Exception as e:
        logger.error(f"Failed to check trial eligibility: {e!s}")
        raise HTTPException(
            status_code=500, detail="Failed to check trial eligibility"
        ) from e
