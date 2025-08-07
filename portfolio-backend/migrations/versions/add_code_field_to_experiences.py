"""add code field to experiences

Revision ID: 7a8b9c0d1e2f
Revises: 7a8bc9def456
Create Date: 2023-07-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = '7a8b9c0d1e2f'
down_revision = '7a8bc9def456'
branch_labels = None
depends_on = None


def upgrade():
    # Get the SQLAlchemy connection
    conn = op.get_bind()
    
    # Get an inspector to check the schema
    inspector = Inspector.from_engine(conn)
    
    # Check if the column already exists
    columns = [col['name'] for col in inspector.get_columns('experiences')]
    if 'code' not in columns:
        # Add code column to experiences table
        op.add_column('experiences', sa.Column('code', sa.String(), nullable=True))
        
        # Create index for code column
        op.create_index(op.f('ix_experiences_code'), 'experiences', ['code'], unique=True)
        
        # Update existing rows with a default code value based on their ID
        # This is needed because we'll make the column non-nullable
        conn.execute(sa.text(
            """
            UPDATE experiences 
            SET code = 'EXP-' || id 
            WHERE code IS NULL
            """
        ))
        
        # Make the code column non-nullable after setting default values
        op.alter_column('experiences', 'code', nullable=False)


def downgrade():
    # Get the SQLAlchemy connection
    conn = op.get_bind()
    
    # Get an inspector to check the schema
    inspector = Inspector.from_engine(conn)
    
    # Check if the column exists before trying to drop it
    columns = [col['name'] for col in inspector.get_columns('experiences')]
    if 'code' in columns:
        # Drop the index first
        indices = [idx['name'] for idx in inspector.get_indexes('experiences')]
        if 'ix_experiences_code' in indices:
            op.drop_index(op.f('ix_experiences_code'), table_name='experiences')
        
        # Then drop the column
        op.drop_column('experiences', 'code') 