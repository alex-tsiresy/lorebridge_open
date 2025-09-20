"""add_user_id_to_artefacts

Revision ID: add_user_id_to_artefacts
Revises: fix_colors_field_cleanup
Create Date: 2025-01-28 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "add_user_id_to_artefacts"
down_revision: str | None = "add_desc_to_artefacts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add user_id column to artefacts table
    op.add_column(
        "artefacts", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key("fk_artefacts_user", "artefacts", "users", ["user_id"], ["id"])

    # Add index for performance
    op.create_index("idx_artefacts_user_id", "artefacts", ["user_id"])

    # Note: We set nullable=True initially to allow existing data
    # In production, you would need to populate user_id for existing artefacts
    # before making the column NOT NULL
    
    # For new deployments, you can uncomment the following lines to make it NOT NULL:
    # After populating existing records with proper user_id values, run:
    # op.alter_column('artefacts', 'user_id', nullable=False)


def downgrade() -> None:
    # Remove index
    op.drop_index("idx_artefacts_user_id", "artefacts")

    # Remove foreign key constraint
    op.drop_constraint("fk_artefacts_user", "artefacts", type_="foreignkey")

    # Remove user_id column
    op.drop_column("artefacts", "user_id")
