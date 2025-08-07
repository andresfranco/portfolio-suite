"""update null experience codes

Revision ID: 8a9b0c1d2e3f
Revises: 7a8b9c0d1e2f
Create Date: 2023-07-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a9b0c1d2e3f'
down_revision = '7a8b9c0d1e2f'
branch_labels = None
depends_on = None


def upgrade():
    # Get the SQLAlchemy connection
    conn = op.get_bind()
    
    # Update any existing experiences with NULL code values
    conn.execute(sa.text(
        """
        UPDATE experiences 
        SET code = 'EXP-' || id 
        WHERE code IS NULL
        """
    ))
    
    # Make sure the code column is not nullable
    try:
        op.alter_column('experiences', 'code', nullable=False)
    except Exception as e:
        # Column might already be non-nullable
        pass


def downgrade():
    # No downgrade needed for this migration
    pass 