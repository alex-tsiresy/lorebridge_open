"""add processing fields to artefacts

Revision ID: add_proc_fields_artefacts
Revises: fix_colors_field_cleanup
Create Date: 2025-08-16 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "add_proc_fields_artefacts"
down_revision: Union[str, None] = "fix_colors_field_cleanup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add new fields to artefacts table if they don't already exist
    if not _has_column("artefacts", "processing_output_type"):
        op.add_column(
            "artefacts",
            sa.Column("processing_output_type", sa.String(), nullable=True),
        )
    if not _has_column("artefacts", "processing_options"):
        op.add_column(
            "artefacts",
            sa.Column("processing_options", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        )
    if not _has_column("artefacts", "processing_primary_option_id"):
        op.add_column(
            "artefacts",
            sa.Column("processing_primary_option_id", sa.String(), nullable=True),
        )
    if not _has_column("artefacts", "selected_processing_option"):
        op.add_column(
            "artefacts",
            sa.Column("selected_processing_option", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        )


def downgrade() -> None:
    # Remove added columns if they exist
    if _has_column("artefacts", "selected_processing_option"):
        op.drop_column("artefacts", "selected_processing_option")
    if _has_column("artefacts", "processing_primary_option_id"):
        op.drop_column("artefacts", "processing_primary_option_id")
    if _has_column("artefacts", "processing_options"):
        op.drop_column("artefacts", "processing_options")
    if _has_column("artefacts", "processing_output_type"):
        op.drop_column("artefacts", "processing_output_type")


