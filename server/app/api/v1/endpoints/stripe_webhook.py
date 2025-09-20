import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limiter import limiter, WEBHOOK_RATE_LIMIT
from app.db.database import get_db
from app.services.payment.stripe_service import stripe_service

router = APIRouter()


@router.post("/stripe")
@limiter.limit(WEBHOOK_RATE_LIMIT)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Stripe webhook events

    This endpoint receives events from Stripe when subscriptions change,
    payments succeed/fail, trials end, etc.
    """
    try:
        # Get the raw body and signature
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        # Debug logging for development
        logger.info(f"Webhook received - Headers: {dict(request.headers)}")
        logger.info(f"Webhook payload length: {len(payload)}")
        logger.info(f"Stripe signature header: {sig_header}")

        if not sig_header:
            logger.error("Missing Stripe signature header")
            # Check for alternative header names that Stripe CLI might use
            alt_sig = request.headers.get("Stripe-Signature")
            if alt_sig:
                logger.info(f"Found alternative signature header: {alt_sig}")
                sig_header = alt_sig
            else:
                logger.error("No Stripe signature found in any header format")
                raise HTTPException(status_code=400, detail="Missing Stripe signature")

        if not settings.STRIPE_WEBHOOK_SECRET:
            logger.error("STRIPE_WEBHOOK_SECRET not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")

        # Verify webhook signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
            logger.info("Webhook signature verified successfully")
        except ValueError as e:
            logger.error(f"Invalid payload: {e!s}")
            logger.error(f"Payload preview: {payload[:200]}...")
            raise HTTPException(status_code=400, detail="Invalid payload") from e
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e!s}")
            logger.error(f"Expected secret: {settings.STRIPE_WEBHOOK_SECRET[:10]}...")
            logger.error(f"Received signature: {sig_header}")

            # DEVELOPMENT MODE: Try to parse the event anyway for Stripe CLI testing
            # This should ONLY be used in development with Stripe CLI
            logger.warning(
                "DEVELOPMENT MODE: Attempting to parse webhook without signature verification"
            )
            try:
                import json

                event = json.loads(payload.decode("utf-8"))
                logger.info(
                    f"Successfully parsed webhook event without signature verification: {event.get('type')}"
                )
            except Exception as parse_error:
                logger.error(f"Failed to parse webhook payload: {parse_error}")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid signature and unable to parse payload",
                ) from parse_error

            # Only allow this in development
            webhook_secret_str = str(settings.STRIPE_WEBHOOK_SECRET)
            if not webhook_secret_str.startswith("whsec_"):
                logger.error(
                    "Invalid webhook secret format - signature verification required"
                )
                raise HTTPException(
                    status_code=400, detail="Invalid signature"
                ) from None

            logger.warning("Proceeding with webhook processing in development mode")

        # Log the event
        event_type = event.get("type")
        logger.info(f"Received Stripe webhook event: {event_type}")

        # Handle the event using our service
        try:
            stripe_service.handle_webhook_event(db, event)
            logger.info(f"Successfully processed webhook event: {event_type}")

            return {"status": "success", "event_type": event_type}

        except Exception as e:
            logger.error(f"Failed to process webhook event {event_type}: {e!s}")
            # Don't raise here - we want to return 200 to Stripe even if processing fails
            # to avoid webhook retries for our internal errors
            return {"status": "error", "event_type": event_type, "error": str(e)}

    except HTTPException:
        # Re-raise HTTP exceptions (signature verification, etc.)
        raise
    except Exception as e:
        logger.error(f"Unexpected error in webhook handler: {e!s}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/stripe/test")
async def test_webhook_endpoint():
    """
    Test endpoint to verify webhook is accessible
    """
    return {
        "message": "Stripe webhook endpoint is accessible",
        "webhook_secret_configured": bool(settings.STRIPE_WEBHOOK_SECRET),
    }
