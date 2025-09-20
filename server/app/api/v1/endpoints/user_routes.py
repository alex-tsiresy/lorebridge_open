from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

# Centralized auth configuration
from app.core.auth_decorators import require_auth
from app.core.rate_limiter import limiter, CREATE_RATE_LIMIT, READ_RATE_LIMIT, API_RATE_LIMIT
from app.db.database import get_db
from app.models.user import User as DBUser
from app.schemas.user import User, UserCreate, UserUpdate

router = APIRouter()


@router.post("/", response_model=User)
@router.post("", response_model=User)
@limiter.limit(CREATE_RATE_LIMIT)
async def create_user(
    request: Request,
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # SECURITY: Verify the authenticated user matches the clerk_user_id being created
    if current_user.clerk_user_id != user.clerk_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to create user with this ID"
        )
    
    # Check if user already exists
    db_user = (
        db.query(DBUser).filter(DBUser.clerk_user_id == user.clerk_user_id).first()
    )
    if db_user:
        raise HTTPException(
            status_code=400, detail="User with this Clerk ID already registered"
        )

    # Create new user
    db_user = DBUser(
        clerk_user_id=user.clerk_user_id,
        subscription_status="free",
        subscription_cancel_at_period_end=False,
        has_used_trial=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/{clerk_user_id}", response_model=User)
@limiter.limit(READ_RATE_LIMIT)
async def read_user(
    request: Request,
    clerk_user_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # Ensure the authenticated user matches the requested user_id for security
    if current_user.clerk_user_id != clerk_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this user's data"
        )

    # Return the current_user directly since we've already verified the ID matches
    return current_user


@router.put("/{clerk_user_id}", response_model=User)
@limiter.limit(API_RATE_LIMIT)
async def update_user(
    request: Request,
    clerk_user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # Ensure the authenticated user matches the requested user_id for security
    if current_user.clerk_user_id != clerk_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this user's data"
        )

    # Update the current user directly
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


# Example of a protected route that requires Clerk authentication
@router.get("/me/", response_model=User)
@router.get("/me", response_model=User)
@limiter.limit(READ_RATE_LIMIT)
async def read_current_user(
    request: Request,
    current_user: DBUser = Depends(require_auth()),
):
    """Return sanitized current user, creating one if necessary."""
    return current_user


@router.delete("/{clerk_user_id}")
@limiter.limit(API_RATE_LIMIT)
def delete_user(
    request: Request,
    clerk_user_id: str,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(require_auth()),
):
    # Ensure the authenticated user matches the requested user_id for security
    if current_user.clerk_user_id != clerk_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this user's data"
        )

    db.delete(current_user)
    db.commit()
    return {"message": "User deleted successfully"}
