"""fix colors field cleanup

Revision ID: fix_colors_field_cleanup
Revises: 42ba7c749b5c
Create Date: 2025-01-01 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fix_colors_field_cleanup'
down_revision: Union[str, None] = '42ba7c749b5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def _get_column_type(table_name: str, column_name: str):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for col in inspector.get_columns(table_name):
        if col["name"] == column_name:
            return col["type"]
    return None


def upgrade() -> None:
    # Normalize to a single 'colors' (STRING) column.
    # 1) If legacy 'color' exists and 'colors' does not, rename it
    if _has_column("graphs", "color") and not _has_column("graphs", "colors"):
        op.alter_column("graphs", "color", new_column_name="colors")

    # 2) Ensure 'colors' column exists
    if not _has_column("graphs", "colors"):
        op.add_column("graphs", sa.Column("colors", sa.String(), nullable=True))

    # 3) If 'colors' exists but is JSON, convert to STRING (text)
    col_type = _get_column_type("graphs", "colors")
    if col_type is not None and (
        isinstance(col_type, postgresql.JSON) or "JSON" in str(col_type).upper()
    ):
        op.alter_column(
            "graphs",
            "colors",
            type_=sa.String(),
            existing_type=postgresql.JSON(astext_type=sa.Text()),
            postgresql_using="colors::text",
        )


def downgrade() -> None:
    # Best-effort downgrade: convert 'colors' back to JSON and reintroduce 'color'
    if _has_column("graphs", "colors"):
        op.alter_column(
            "graphs",
            "colors",
            type_=postgresql.JSON(astext_type=sa.Text()),
            existing_type=sa.String(),
            postgresql_using="to_jsonb(colors)",
        )
    if not _has_column("graphs", "color"):
        op.add_column("graphs", sa.Column("color", sa.String(), nullable=True))