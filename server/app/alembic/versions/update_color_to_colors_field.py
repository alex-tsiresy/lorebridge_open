"""update color field to colors field

Revision ID: update_color_to_colors_field
Revises: add_color_field_to_graphs
Create Date: 2024-01-01 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision = "update_color_to_colors_field"
down_revision = "add_color_field_to_graphs"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade():
    # Rename color column to colors if present; no-op if already renamed or absent
    if _has_column("graphs", "color") and not _has_column("graphs", "colors"):
        op.alter_column("graphs", "color", new_column_name="colors")
    # Keep as string type since colors are RGB strings like "rgb(255, 0, 0)"
    # No type conversion needed


def downgrade():
    # Revert back only if 'colors' exists
    if _has_column("graphs", "colors") and not _has_column("graphs", "color"):
        op.alter_column("graphs", "colors", new_column_name="color")
        op.alter_column("graphs", "color", type_=sa.String())
