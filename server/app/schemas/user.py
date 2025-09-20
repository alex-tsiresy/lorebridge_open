from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserBase(BaseModel):
    clerk_user_id: str


class UserCreate(UserBase):
    pass  # No password needed, Clerk handles authentication


class UserUpdate(BaseModel):
    is_active: bool | None = None
    subscription_status: str | None = None
    stripe_customer_id: str | None = None
    subscription_id: str | None = None
    subscription_current_period_end: datetime | None = None
    subscription_cancel_at_period_end: bool | None = None
    trial_end_date: datetime | None = None
    has_used_trial: bool | None = None


class User(UserBase):
    id: UUID
    is_active: bool
    subscription_status: str = "free"
    stripe_customer_id: str | None = None
    subscription_id: str | None = None
    subscription_current_period_end: datetime | None = None
    subscription_cancel_at_period_end: bool = False
    trial_end_date: datetime | None = None
    has_used_trial: bool = False

    class Config:
        from_attributes = True
