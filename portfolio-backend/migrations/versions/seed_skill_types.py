"""seed_skill_types

Revision ID: seed_skill_types
Revises: create_skill_types_table
Create Date: 2025-03-20 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, select, exists
from datetime import datetime
import logging


# revision identifiers, used by Alembic.
revision: str = 'seed_skill_types'
down_revision: Union[str, None] = 'create_skill_types_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name):
    """Check if a table exists in the database."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def check_if_type_exists(connection, code):
    """Check if a skill type with the given code exists."""
    skill_types_table = sa.Table(
        'skill_types',
        sa.MetaData(),
        sa.Column('code', sa.String)
    )
    
    query = select([exists().where(skill_types_table.c.code == code)])
    result = connection.execute(query)
    return result.scalar()


def upgrade() -> None:
    # Check if the skill_types table exists
    if not table_exists('skill_types'):
        logging.warning("skill_types table does not exist, skipping seed operation")
        return
    
    # Define table structure for bulk insert
    skill_types_table = table('skill_types',
        column('code', sa.String),
        column('name', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime)
    )
    
    # Current timestamp for created_at and updated_at
    now = datetime.utcnow()
    
    # Get a connection to the database
    connection = op.get_bind()
    
    # Define the skill types to insert
    skill_types = [
        {'code': 'SOFT', 'name': 'Soft Skills', 'created_at': now, 'updated_at': now},
        {'code': 'HARD', 'name': 'Hard Skills', 'created_at': now, 'updated_at': now},
        {'code': 'TECH', 'name': 'Technical Skills', 'created_at': now, 'updated_at': now},
        {'code': 'LANG', 'name': 'Language Skills', 'created_at': now, 'updated_at': now},
        {'code': 'FRAM', 'name': 'Framework Skills', 'created_at': now, 'updated_at': now},
        {'code': 'TOOL', 'name': 'Tool Skills', 'created_at': now, 'updated_at': now},
        {'code': 'OTHR', 'name': 'Other Skills', 'created_at': now, 'updated_at': now}
    ]
    
    # Insert skill types one by one, checking if they already exist
    for skill_type in skill_types:
        try:
            if not check_if_type_exists(connection, skill_type['code']):
                op.bulk_insert(
                    skill_types_table,
                    [skill_type]
                )
                logging.info(f"Inserted skill type {skill_type['code']}")
            else:
                logging.info(f"Skill type {skill_type['code']} already exists, skipping")
        except Exception as e:
            logging.warning(f"Error inserting skill type {skill_type['code']}: {str(e)}")
    
    # Update existing skills to match their type with the new type_code if skills table exists
    if table_exists('skills'):
        try:
            op.execute("UPDATE skills SET type_code = 'SOFT' WHERE type = 'soft' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'HARD' WHERE type = 'hard' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'TECH' WHERE type = 'technical' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'LANG' WHERE type = 'language' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'FRAM' WHERE type = 'framework' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'TOOL' WHERE type = 'tool' AND type_code IS NULL")
            op.execute("UPDATE skills SET type_code = 'OTHR' WHERE type = 'other' AND type_code IS NULL")
            logging.info("Updated existing skills with type_code values")
        except Exception as e:
            logging.warning(f"Error updating skills type_code: {str(e)}")


def downgrade() -> None:
    # Check if the skill_types table exists
    if not table_exists('skill_types'):
        logging.warning("skill_types table does not exist, skipping downgrade operation")
        return
    
    # Remove the seeded data
    try:
        op.execute("DELETE FROM skill_types WHERE code IN ('SOFT', 'HARD', 'TECH', 'LANG', 'FRAM', 'TOOL', 'OTHR')")
        logging.info("Removed seeded skill types")
    except Exception as e:
        logging.warning(f"Error removing skill types: {str(e)}")
    
    # Reset the type_code in skills table if it exists
    if table_exists('skills'):
        try:
            op.execute("UPDATE skills SET type_code = NULL")
            logging.info("Reset type_code in skills table")
        except Exception as e:
            logging.warning(f"Error resetting type_code in skills table: {str(e)}") 