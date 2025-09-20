"""add color field to graphs

Revision ID: add_color_field_to_graphs
Revises: 0922cff1a8dd
Create Date: 2024-01-01 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_color_field_to_graphs"
down_revision = "43972a1333f6"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade():
    # Add color column to graphs table if not present
    if not _has_column("graphs", "color") and not _has_column("graphs", "colors"):
        op.add_column("graphs", sa.Column("color", sa.String(), nullable=True))


def downgrade():
    # Remove color column from graphs table if present
    if _has_column("graphs", "color"):
        op.drop_column("graphs", "color")
