#!/usr/bin/env python
"""
PostgreSQL Permissions Test Script

This script tests CRUD operations on the permissions table using direct SQL queries
rather than SQLAlchemy ORM. This helps verify that PostgreSQL connectivity and permissions
are working correctly even if the ORM layer has issues.
"""

import sys
import logging
import random
import string
import time
import uuid
import psycopg2
from psycopg2 import sql
from urllib.parse import urlparse, unquote

from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("postgres_permissions_test")

def parse_db_url(url):
    """Parse a database URL into components."""
    parsed = urlparse(url)
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    database = parsed.path[1:]  # Remove leading slash
    host = parsed.hostname
    port = parsed.port or 5432
    
    return {
        "dbname": database,
        "user": username,
        "password": password,
        "host": host,
        "port": port
    }

def get_connection():
    """Establish a connection to PostgreSQL."""
    db_params = parse_db_url(settings.DATABASE_URL)
    logger.info(f"Connecting to PostgreSQL at {db_params['host']}:{db_params['port']}/{db_params['dbname']}")
    
    # Connect to the database
    try:
        conn = psycopg2.connect(**db_params)
        conn.autocommit = False  # We'll manage transactions explicitly
        logger.info("Successfully connected to PostgreSQL")
        return conn
    except Exception as e:
        logger.error(f"Error connecting to PostgreSQL: {str(e)}")
        raise

def generate_test_permission_name():
    """Generate a unique permission name for testing."""
    return f"TEST_SQL_PERMISSION_{str(uuid.uuid4())[:8]}"

def test_permission_crud():
    """Test CRUD operations on permissions table."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Generate unique test data
        test_name = generate_test_permission_name()
        test_description = f"Test permission created at {time.time()}"
        updated_description = f"Updated description at {time.time()}"
        
        logger.info(f"Starting permission CRUD test with name: {test_name}")
        
        # 1. Test permission existence and cleanup
        cursor.execute(
            "SELECT id FROM permissions WHERE name = %s", 
            (test_name,)
        )
        existing = cursor.fetchone()
        if existing:
            logger.info(f"Cleaning up existing permission: {test_name}")
            cursor.execute("DELETE FROM permissions WHERE name = %s", (test_name,))
            conn.commit()
        
        # 2. CREATE: Insert a new permission
        logger.info(f"Creating new permission: {test_name}")
        cursor.execute(
            "INSERT INTO permissions (name, description) VALUES (%s, %s) RETURNING id",
            (test_name, test_description)
        )
        permission_id = cursor.fetchone()[0]
        conn.commit()
        logger.info(f"Created permission with ID: {permission_id}")
        
        # 3. READ: Retrieve the permission
        logger.info(f"Reading permission with ID: {permission_id}")
        cursor.execute(
            "SELECT id, name, description FROM permissions WHERE id = %s",
            (permission_id,)
        )
        permission = cursor.fetchone()
        if permission:
            logger.info(f"Retrieved permission: {permission}")
        else:
            logger.error(f"Failed to retrieve permission with ID: {permission_id}")
            return False
        
        # 4. UPDATE: Update the permission description
        logger.info(f"Updating permission {permission_id} with new description")
        cursor.execute(
            "UPDATE permissions SET description = %s WHERE id = %s",
            (updated_description, permission_id)
        )
        conn.commit()
        
        # Verify update
        cursor.execute(
            "SELECT description FROM permissions WHERE id = %s",
            (permission_id,)
        )
        updated = cursor.fetchone()
        if updated and updated[0] == updated_description:
            logger.info(f"Successfully updated permission: {updated}")
        else:
            logger.error("Failed to update permission")
            return False
        
        # 5. DELETE: Delete the permission
        logger.info(f"Deleting permission with ID: {permission_id}")
        cursor.execute(
            "DELETE FROM permissions WHERE id = %s",
            (permission_id,)
        )
        conn.commit()
        
        # Verify deletion
        cursor.execute(
            "SELECT id FROM permissions WHERE id = %s",
            (permission_id,)
        )
        if cursor.fetchone() is None:
            logger.info("Successfully deleted permission")
        else:
            logger.error("Failed to delete permission")
            return False
        
        logger.info("All permission CRUD operations completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error during permission CRUD test: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
            logger.info("Database connection closed")

def main():
    """Main entry point."""
    logger.info("Starting PostgreSQL permissions test")
    
    success = test_permission_crud()
    
    if success:
        logger.info("✅ All PostgreSQL permission tests passed")
        return 0
    else:
        logger.error("❌ PostgreSQL permission tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 