"""add_user_id_to_assets

Revision ID: 42ba7c749b5c
Revises: update_color_to_colors_field
Create Date: 2025-07-28 17:40:10.164422

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "42ba7c749b5c"
down_revision: str | None = "update_color_to_colors_field"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add user_id column to asset table
    op.add_column(
        "asset", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key("fk_asset_user", "asset", "users", ["user_id"], ["id"])

    # Add index for performance
    op.create_index("idx_asset_user_id", "asset", ["user_id"])


def downgrade() -> None:
    # Remove index
    op.drop_index("idx_asset_user_id", "asset")

    # Remove foreign key constraint
    op.drop_constraint("fk_asset_user", "asset", type_="foreignkey")

    # Remove user_id column
    op.drop_column("asset", "user_id")
