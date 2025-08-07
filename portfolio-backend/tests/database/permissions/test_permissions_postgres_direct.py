#!/usr/bin/env python3
"""
Direct PostgreSQL Permission Tests
---------------------------------

This module tests the permissions functionality using direct PostgreSQL connections
instead of relying on SQLAlchemy and pytest fixtures. This allows for better
transaction control and is useful for testing permissions without breaking tables.
"""

import sys
import logging
import uuid
import time
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse, unquote

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Import application settings
from app.core.config import settings

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

@pytest.fixture
def pg_conn(engine):
    """Fixture to provide a PostgreSQL database connection from the SQLAlchemy engine."""
    db_params = parse_db_url(settings.DATABASE_URL)
    
    # Mask password for display
    masked_url = f"postgresql://{db_params['user']}:******@{db_params['host']}:{db_params['port']}/{db_params['dbname']}"
    logger.info(f"Connecting to PostgreSQL at {masked_url}")
    
    try:
        # Connect with dictionary cursor for easier data access
        conn = psycopg2.connect(**db_params)
        conn.autocommit = False
        logger.info("Successfully connected to PostgreSQL")
        yield conn
        conn.rollback()  # Roll back any pending transactions
        conn.close()
        logger.info("Database connection closed")
    except Exception as e:
        logger.error(f"Error connecting to PostgreSQL: {str(e)}")
        raise

@pytest.fixture
def test_permission_id(pg_conn):
    """Fixture to provide a test permission ID."""
    test_name = f"TEST_PERMISSION_{uuid.uuid4().hex[:8].upper()}"
    test_description = f"Test permission created at {time.time()}"
    
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Insert new permission
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (test_name, test_description))
        
        new_perm = cursor.fetchone()
        pg_conn.commit()
        
        logger.info(f"Created permission: {new_perm['id']}: {new_perm['name']} - {new_perm['description']}")
        
        yield new_perm['id']
        
        # Clean up after test
        cursor.execute("DELETE FROM permissions WHERE id = %s", (new_perm['id'],))
        pg_conn.commit()
        logger.info(f"Cleaned up test permission with ID: {new_perm['id']}")

def generate_test_name():
    """Generate a unique test permission name."""
    return f"TEST_PERMISSION_{uuid.uuid4().hex[:8].upper()}"

def test_permission_create(pg_conn):
    """Test creating a permission."""
    test_name = generate_test_name()
    test_description = f"Test permission created at {time.time()}"
    
    logger.info(f"Testing permission creation with name: {test_name}")
    
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Insert new permission
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (test_name, test_description))
        
        new_perm = cursor.fetchone()
        pg_conn.commit()
        
        logger.info(f"Created permission: {new_perm['id']}: {new_perm['name']} - {new_perm['description']}")
        
        # Verify it exists
        cursor.execute("""
            SELECT id, name, description 
            FROM permissions 
            WHERE id = %s
        """, (new_perm['id'],))
        
        verification = cursor.fetchone()
        assert verification is not None, f"Failed to verify permission with ID: {new_perm['id']}"
        logger.info(f"Verified permission exists: {verification['name']}")
        
        # Clean up
        cursor.execute("DELETE FROM permissions WHERE id = %s", (new_perm['id'],))
        pg_conn.commit()
        logger.info(f"Cleaned up test permission with ID: {new_perm['id']}")

def test_permission_update(pg_conn, test_permission_id):
    """Test updating a permission."""
    updated_description = f"Updated description at {time.time()}"
    
    logger.info(f"Testing permission update for ID: {test_permission_id}")
    
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Update permission
        cursor.execute("""
            UPDATE permissions 
            SET description = %s
            WHERE id = %s
            RETURNING id, name, description
        """, (updated_description, test_permission_id))
        
        updated_perm = cursor.fetchone()
        pg_conn.commit()
        
        assert updated_perm is not None, f"Failed to update permission with ID: {test_permission_id}"
        assert updated_perm['description'] == updated_description, "Description was not updated correctly"
        
        logger.info(f"Updated permission: {updated_perm['id']}: {updated_perm['name']} - {updated_perm['description']}")

def test_permission_delete(pg_conn):
    """Test deleting a permission."""
    test_name = generate_test_name()
    test_description = f"Test permission for deletion test"
    
    logger.info(f"Testing permission deletion with name: {test_name}")
    
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Create a test permission first
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id
        """, (test_name, test_description))
        
        perm_id = cursor.fetchone()['id']
        pg_conn.commit()
        
        logger.info(f"Created permission with ID: {perm_id} for deletion test")
        
        # Delete permission
        cursor.execute("""
            DELETE FROM permissions
            WHERE id = %s
            RETURNING id
        """, (perm_id,))
        
        result = cursor.fetchone()
        pg_conn.commit()
        
        assert result is not None, f"Failed to delete permission with ID: {perm_id}"
        logger.info(f"Successfully deleted permission with ID: {perm_id}")
        
        # Verify it's gone
        cursor.execute("""
            SELECT COUNT(*) 
            FROM permissions 
            WHERE id = %s
        """, (perm_id,))
        
        count = cursor.fetchone()['count']
        assert count == 0, f"Permission with ID {perm_id} still exists after deletion!"
        logger.info(f"Verified permission with ID {perm_id} is gone")

def test_permission_search(pg_conn):
    """Test searching for permissions with filters."""
    logger.info("Testing permission search...")
    
    # Create test permissions for searching
    test_permissions = []
    base_name = f"SEARCH_TEST_{uuid.uuid4().hex[:6].upper()}"
    
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Create three test permissions
        for i in range(3):
            cursor.execute("""
                INSERT INTO permissions (name, description)
                VALUES (%s, %s)
                RETURNING id, name
            """, (f"{base_name}_{i}", f"Search test permission {i}"))
            perm = cursor.fetchone()
            test_permissions.append(perm)
        
        pg_conn.commit()
        logger.info(f"Created {len(test_permissions)} test permissions for search test")
        
        try:
            # Search for test permissions
            cursor.execute("""
                SELECT id, name, description
                FROM permissions
                WHERE name LIKE %s
                ORDER BY id DESC
                LIMIT 5
            """, (f"{base_name}_%",))
            
            results = cursor.fetchall()
            assert len(results) == 3, f"Expected 3 test permissions, found {len(results)}"
            logger.info(f"Found {len(results)} test permissions in search")
            
            # Test exact name match
            cursor.execute("""
                SELECT id, name
                FROM permissions 
                WHERE name = %s
            """, (f"{base_name}_1",))
            
            exact_match = cursor.fetchone()
            assert exact_match is not None, f"Failed to find permission with exact name: {base_name}_1"
            logger.info(f"Found permission with exact name match: {exact_match['name']}")
            
        finally:
            # Clean up all test permissions
            for perm in test_permissions:
                cursor.execute("DELETE FROM permissions WHERE id = %s", (perm['id'],))
            
            pg_conn.commit()
            logger.info(f"Cleaned up {len(test_permissions)} test permissions") 