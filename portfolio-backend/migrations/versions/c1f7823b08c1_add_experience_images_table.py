"""Add experience images table to support CMS uploads

Revision ID: c1f7823b08c1
Revises: a23841bd6e30
Create Date: 2025-11-15 10:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1f7823b08c1"
down_revision: Union[str, None] = "a23841bd6e30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "experience_images",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id"), nullable=False),
        sa.Column("experience_text_id", sa.Integer(), sa.ForeignKey("experience_texts.id"), nullable=True),
        sa.Column("image_path", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column(
            "category",
            sa.String(),
            nullable=False,
            server_default=sa.text("'content'"),
        ),
        sa.Column("language_id", sa.Integer(), sa.ForeignKey("languages.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_experience_images_experience_id_category",
        "experience_images",
        ["experience_id", "category"],
        unique=False,
    )
    op.create_index(
        "ix_experience_images_experience_text_id",
        "experience_images",
        ["experience_text_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_experience_images_experience_text_id", table_name="experience_images")
    op.drop_index("ix_experience_images_experience_id_category", table_name="experience_images")
    op.drop_table("experience_images")
