"""add youtube and instagram asset types

Revision ID: add_youtube_instagram_enum
Revises: 318a42f56b87
Create Date: 2024-07-11 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_youtube_instagram_enum"
down_revision: str | None = "318a42f56b87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'youtube';")
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'instagram';")


def downgrade() -> None:
    # Downgrade not supported for enum value removal
    pass
