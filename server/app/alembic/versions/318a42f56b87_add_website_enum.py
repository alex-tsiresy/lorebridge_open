"""add website enum

Revision ID: 318a42f56b87
Revises: e7f2d992db1c
Create Date: 2025-07-11 06:16:56.033749

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "318a42f56b87"
down_revision: str | None = "e7f2d992db1c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'website';")


def downgrade() -> None:
    # Downgrade not supported for enum value removal
    pass
