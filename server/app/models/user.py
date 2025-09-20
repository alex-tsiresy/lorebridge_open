import uuid

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    clerk_user_id = Column(String, unique=True, index=True)  # Clerk's user ID
    is_active = Column(Boolean, default=True)
    ip_address = Column(String)
    user_agent = Column(String)
    os = Column(String)
    country = Column(String)

    # Stripe subscription fields with proper defaults and constraints
    subscription_status = Column(
        String, nullable=False, default="free"
    )  # free, trialing, active, past_due, canceled, unpaid
    stripe_customer_id = Column(String, nullable=True)
    subscription_id = Column(String, nullable=True)
    subscription_current_period_end = Column(DateTime, nullable=True)
    subscription_cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    trial_end_date = Column(DateTime, nullable=True)
    has_used_trial = Column(Boolean, nullable=False, default=False)
