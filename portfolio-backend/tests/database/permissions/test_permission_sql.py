#!/usr/bin/env python3
"""
Permission SQL Test
------------------

This script tests the PostgreSQL connection using raw SQL operations
on the permissions table directly.
"""
import sys
import logging
from sqlalchemy import create_engine, text
from urllib.parse import unquote

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import settings
from app.core.config import settings

def test_permissions_sql():
    """Test SQL operations on permissions table."""
    db_url = settings.DATABASE_URL
    
    # Mask password for display
    display_url = unquote(db_url)
    if '@' in display_url:
        parts = display_url.split('@')
        auth = parts[0].split(':')
        if len(auth) > 1:
            masked_url = f"{auth[0]}:********@{parts[1]}"
        else:
            masked_url = display_url
    else:
        masked_url = display_url
    
    logger.info(f"Testing permissions with SQL on: {masked_url}")
    
    try:
        # Create engine and connect
        engine = create_engine(db_url)
        with engine.connect() as conn:
            logger.info("Connected successfully to the database")
            
            # 1. Create a test permission
            test_perm_name = "SQL_TEST_PERMISSION"
            logger.info(f"Step 1: Creating test permission: {test_perm_name}")
            
            # Check if test permission exists and delete it
            result = conn.execute(text(
                "SELECT id FROM permissions WHERE name = :name"
            ), {"name": test_perm_name})
            existing = result.scalar()
            if existing:
                logger.info(f"Permission {test_perm_name} already exists (ID: {existing}), deleting first")
                conn.execute(text(
                    "DELETE FROM permissions WHERE id = :id"
                ), {"id": existing})
                conn.commit()
            
            # Insert test permission
            result = conn.execute(text("""
                INSERT INTO permissions (name, description) 
                VALUES (:name, :description)
                RETURNING id
            """), {
                "name": test_perm_name,
                "description": "Test permission for SQL operations"
            })
            perm_id = result.scalar()
            conn.commit()
            logger.info(f"Created permission with ID: {perm_id}")
            
            # 2. Read the permission
            logger.info(f"Step 2: Reading permission with ID: {perm_id}")
            result = conn.execute(text("""
                SELECT id, name, description 
                FROM permissions 
                WHERE id = :id
            """), {"id": perm_id})
            row = result.fetchone()
            if row:
                logger.info(f"Read permission: {row[0]}: {row[1]} - {row[2]}")
            else:
                logger.error(f"Permission with ID {perm_id} not found")
                return False
            
            # 3. Update the permission
            logger.info(f"Step 3: Updating permission with ID: {perm_id}")
            conn.execute(text("""
                UPDATE permissions
                SET description = :description
                WHERE id = :id
            """), {
                "id": perm_id,
                "description": "Updated test permission description"
            })
            conn.commit()
            
            # Verify update
            result = conn.execute(text("""
                SELECT description FROM permissions WHERE id = :id
            """), {"id": perm_id})
            updated_desc = result.scalar()
            logger.info(f"Updated description: {updated_desc}")
            
            # 4. Find permission by partial name
            logger.info(f"Step 4: Finding permissions with 'TEST' in name")
            result = conn.execute(text("""
                SELECT id, name, description 
                FROM permissions 
                WHERE name LIKE :pattern
                ORDER BY id
            """), {"pattern": "%TEST%"})
            rows = result.fetchall()
            logger.info(f"Found {len(rows)} permissions matching 'TEST':")
            for row in rows:
                logger.info(f"- {row[0]}: {row[1]} - {row[2]}")
            
            # 5. Delete the permission
            logger.info(f"Step 5: Deleting permission with ID: {perm_id}")
            conn.execute(text("""
                DELETE FROM permissions WHERE id = :id
            """), {"id": perm_id})
            conn.commit()
            
            # Verify deletion
            result = conn.execute(text("""
                SELECT COUNT(*) FROM permissions WHERE id = :id
            """), {"id": perm_id})
            count = result.scalar()
            if count == 0:
                logger.info(f"Successfully deleted permission with ID: {perm_id}")
            else:
                logger.error(f"Failed to delete permission with ID: {perm_id}")
                return False
            
            logger.info("All SQL operations on permissions completed successfully")
            return True
    except Exception as e:
        logger.error(f"Error in SQL operations: {str(e)}")
        return False

def main():
    """Main function."""
    logger.info("Starting permissions SQL test")
    
    if test_permissions_sql():
        logger.info("Test completed successfully!")
    else:
        logger.error("Test failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 