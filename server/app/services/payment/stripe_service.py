import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any

import stripe
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


class StripeService:
    def __init__(self):
        """Initialize Stripe service with API key"""
        if not settings.STRIPE_SECRET_KEY:
            raise ValueError("STRIPE_SECRET_KEY is required")
        stripe.api_key = settings.STRIPE_SECRET_KEY
        self.executor = ThreadPoolExecutor(max_workers=5)
        self.timeout = 30.0  # 30 second timeout for Stripe operations

    async def create_customer(self, user: User, email: str) -> str:
        """
        Create a Stripe customer for a user

        Args:
            user: User model instance
            email: User's email address

        Returns:
            Stripe customer ID
        """
        try:
            loop = asyncio.get_event_loop()
            customer = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: stripe.Customer.create(
                        email=email,
                        metadata={"user_id": str(user.id), "clerk_user_id": user.clerk_user_id},
                    )
                ),
                timeout=self.timeout
            )
            logger.info("Created Stripe customer successfully")
            return customer.id
        except asyncio.TimeoutError:
            logger.error("Stripe Customer.create operation timed out")
            raise Exception("Stripe operation timed out")
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {e!s}")
            raise

    def check_trial_eligibility(self, user: User) -> bool:
        """
        Check if user is eligible for a free trial

        Args:
            user: User model instance

        Returns:
            True if user can start a trial, False otherwise
        """
        # User is eligible if they haven't used trial and are on free plan
        return not user.has_used_trial and user.subscription_status == "free"

    async def create_checkout_session(
        self,
        user: User,
        customer_id: str,
        success_url: str,
        cancel_url: str,
        with_trial: bool = True,
    ) -> dict[str, Any]:
        """
        Create a Stripe checkout session for subscription

        Args:
            user: User model instance
            customer_id: Stripe customer ID
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect after cancelled payment
            with_trial: Whether to include 7-day trial

        Returns:
            Checkout session data
        """
        if not settings.STRIPE_PRICE_ID_MONTHLY_PRO:
            raise ValueError("STRIPE_PRICE_ID_MONTHLY_PRO is required")

        try:
            session_params = {
                "customer": customer_id,
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "price": settings.STRIPE_PRICE_ID_MONTHLY_PRO,
                        "quantity": 1,
                    }
                ],
                "mode": "subscription",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "user_id": str(user.id),
                    "clerk_user_id": user.clerk_user_id,
                },
            }

            # Add trial if eligible and requested
            if with_trial and self.check_trial_eligibility(user):
                session_params["subscription_data"] = {
                    "trial_period_days": 7,
                    "metadata": {"user_id": str(user.id), "is_trial": "true"},
                }
                logger.info(
                    "Adding 7-day trial to checkout session for user"
                )

            loop = asyncio.get_event_loop()
            session = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: stripe.checkout.Session.create(**session_params)
                ),
                timeout=self.timeout
            )
            logger.info("Created checkout session successfully")
            return {"session_id": session.id, "url": session.url}

        except asyncio.TimeoutError:
            logger.error("Stripe checkout session creation timed out")
            raise Exception("Stripe operation timed out")
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {e!s}")
            raise

    async def create_customer_portal_session(self, customer_id: str, return_url: str) -> str:
        """
        Create a customer portal session for subscription management

        Args:
            customer_id: Stripe customer ID
            return_url: URL to return to after portal session

        Returns:
            Portal session URL
        """
        try:
            loop = asyncio.get_event_loop()
            session = await asyncio.wait_for(
                loop.run_in_executor(
                    self.executor,
                    lambda: stripe.billing_portal.Session.create(
                        customer=customer_id,
                        return_url=return_url,
                    )
                ),
                timeout=self.timeout
            )
            logger.info(f"Created customer portal session for customer {customer_id}")
            return session.url

        except asyncio.TimeoutError:
            logger.error("Stripe customer portal session creation timed out")
            raise Exception("Stripe operation timed out")
        except stripe.error.InvalidRequestError as e:
            # Check if it's a configuration issue
            if "No configuration provided" in str(e):
                logger.error(
                    "Stripe Customer Portal configuration not set up. Please visit https://dashboard.stripe.com/test/settings/billing/portal to create your default configuration."
                )
                raise Exception(
                    "Customer portal not configured. Please set up your customer portal in the Stripe dashboard: "
                    "https://dashboard.stripe.com/test/settings/billing/portal"
                ) from e
            else:
                logger.error(f"Failed to create customer portal session: {e!s}")
                raise

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create customer portal session: {e!s}")
            raise

    def sync_subscription_status(
        self, db: Session, user_id: str, subscription_data: dict[str, Any]
    ) -> None:
        """
        Sync subscription status from Stripe to database

        Args:
            db: Database session
            user_id: User ID
            subscription_data: Subscription data from Stripe
        """
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found for subscription sync")
                return

            # Update subscription fields
            user.subscription_status = subscription_data.get("status", "free")
            user.subscription_id = subscription_data.get("id")
            user.subscription_current_period_end = (
                datetime.fromtimestamp(subscription_data.get("current_period_end", 0))
                if subscription_data.get("current_period_end")
                else None
            )
            user.subscription_cancel_at_period_end = subscription_data.get(
                "cancel_at_period_end", False
            )

            # Handle trial
            if subscription_data.get("trial_end"):
                user.trial_end_date = datetime.fromtimestamp(
                    subscription_data["trial_end"]
                )
                user.has_used_trial = True

            db.commit()
            logger.info(
                f"Synced subscription status for user {user_id}: {user.subscription_status}"
            )

        except Exception as e:
            logger.error(f"Failed to sync subscription status: {e!s}")
            db.rollback()
            raise

    def handle_webhook_event(self, db: Session, event: dict[str, Any]) -> None:
        """
        Handle Stripe webhook events

        Args:
            db: Database session
            event: Stripe webhook event data
        """
        event_type = event.get("type")
        data = event.get("data", {}).get("object", {})

        logger.info(f"Processing webhook event: {event_type}")

        try:
            if event_type in [
                "customer.subscription.created",
                "customer.subscription.updated",
                "customer.subscription.deleted",
            ]:
                self._handle_subscription_event(db, data)

            elif event_type == "customer.subscription.trial_will_end":
                self._handle_trial_will_end(db, data)

            elif event_type in ["invoice.payment_succeeded", "invoice.payment_failed"]:
                self._handle_payment_event(db, event_type, data)

        except Exception as e:
            logger.error(f"Failed to process webhook event {event_type}: {e!s}")
            raise

    def _handle_subscription_event(
        self, db: Session, subscription_data: dict[str, Any]
    ) -> None:
        """Handle subscription-related webhook events"""
        customer_id = subscription_data.get("customer")
        if not customer_id:
            logger.error("No customer ID in subscription event")
            return

        # First, try to find user by Stripe customer ID
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if not user:
            logger.warning(f"User not found by stripe_customer_id: {customer_id}")

            # Try to find user by metadata in the subscription
            metadata = subscription_data.get("metadata", {})
            user_id = metadata.get("user_id")
            clerk_user_id = metadata.get("clerk_user_id")

            if user_id:
                logger.info(f"Attempting to find user by metadata user_id: {user_id}")
                user = db.query(User).filter(User.id == user_id).first()
            elif clerk_user_id:
                logger.info(
                    f"Attempting to find user by metadata clerk_user_id: {clerk_user_id}"
                )
                user = (
                    db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
                )

            if not user:
                # Try to get customer from Stripe and check its metadata
                try:
                    # Note: This is sync call in webhook handler - consider making webhook handler async
                    customer = stripe.Customer.retrieve(customer_id)
                    customer_metadata = customer.get("metadata", {})

                    if customer_metadata.get("user_id"):
                        logger.info(
                            f"Found user_id in customer metadata: {customer_metadata['user_id']}"
                        )
                        user = (
                            db.query(User)
                            .filter(User.id == customer_metadata["user_id"])
                            .first()
                        )
                    elif customer_metadata.get("clerk_user_id"):
                        logger.info(
                            f"Found clerk_user_id in customer metadata: {customer_metadata['clerk_user_id']}"
                        )
                        user = (
                            db.query(User)
                            .filter(
                                User.clerk_user_id == customer_metadata["clerk_user_id"]
                            )
                            .first()
                        )

                except stripe.error.StripeError as e:
                    logger.error(f"Failed to retrieve customer {customer_id}: {e}")

            if not user:
                logger.error(
                    f"Could not find user for Stripe customer {customer_id} using any method"
                )
                return

            # Update the user's stripe_customer_id now that we found them
            logger.info(
                "Updating user with stripe_customer_id"
            )
            user.stripe_customer_id = customer_id
            db.commit()

        # Now sync the subscription status
        logger.info("Syncing subscription status for user")
        self.sync_subscription_status(db, str(user.id), subscription_data)

    def _handle_trial_will_end(
        self, db: Session, subscription_data: dict[str, Any]
    ) -> None:
        """Handle trial ending soon event"""
        customer_id = subscription_data.get("customer")
        if not customer_id:
            return

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user:
            return

        # Here you could send email notifications, etc.
        logger.info("Trial will end soon for user")

    def _handle_payment_event(
        self, db: Session, event_type: str, invoice_data: dict[str, Any]
    ) -> None:
        """Handle payment success/failure events"""
        customer_id = invoice_data.get("customer")
        if not customer_id:
            return

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if not user:
            return

        if event_type == "invoice.payment_succeeded":
            logger.info("Payment succeeded for user")
            # Could trigger success actions here

        elif event_type == "invoice.payment_failed":
            logger.warning("Payment failed for user")
            # Could trigger failure actions here

    def cleanup(self):
        """Cleanup thread pool executor."""
        self.executor.shutdown(wait=True)


# Create singleton instance
stripe_service = StripeService()
