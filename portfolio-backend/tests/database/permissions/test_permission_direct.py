#!/usr/bin/env python3
"""
Direct PostgreSQL Permission Tests
---------------------------------

This module contains tests for permissions using direct PostgreSQL connections
with psycopg2, without relying on SQLAlchemy ORM.
"""

import sys
import logging
import uuid
import time
import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse, unquote

from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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
def conn():
    """Fixture to provide a PostgreSQL database connection."""
    db_params = parse_db_url(settings.DATABASE_URL)
    
    # Mask password for display
    masked_url = f"postgresql://{db_params['user']}:******@{db_params['host']}:{db_params['port']}/{db_params['dbname']}"
    logger.info(f"Connecting to PostgreSQL at {masked_url}")
    
    try:
        # Connect with dictionary cursor for easier data access
        connection = psycopg2.connect(**db_params)
        connection.autocommit = False
        logger.info("Successfully connected to PostgreSQL")
        yield connection
        connection.rollback()  # Roll back any pending transactions
        connection.close()
        logger.info("Database connection closed")
    except Exception as e:
        logger.error(f"Error connecting to PostgreSQL: {str(e)}")
        raise

@pytest.fixture
def perm_id(conn):
    """Fixture to provide a test permission ID."""
    test_name = f"TEST_PERMISSION_{uuid.uuid4().hex[:8].upper()}"
    test_description = f"Test permission created at {time.time()}"
    
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Insert new permission
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id
        """, (test_name, test_description))
        
        new_perm_id = cursor.fetchone()['id']
        conn.commit()  # Commit so the permission exists for the test
        
        logger.info(f"Created test permission with ID: {new_perm_id}")
        
        yield new_perm_id
        
        # Clean up the permission after the test
        try:
            cursor.execute("DELETE FROM permissions WHERE id = %s", (new_perm_id,))
            conn.commit()
            logger.info(f"Cleaned up test permission with ID: {new_perm_id}")
        except Exception as e:
            logger.error(f"Failed to clean up test permission: {str(e)}")
            conn.rollback()

def test_permission_create(conn):
    """Test creating a permission."""
    test_name = f"TEST_PERMISSION_{uuid.uuid4().hex[:8].upper()}"
    test_description = f"Test permission created at {time.time()}"
    
    logger.info(f"Testing permission creation with name: {test_name}")
    
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Insert new permission
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id, name, description
        """, (test_name, test_description))
        
        new_perm = cursor.fetchone()
        conn.commit()
        
        logger.info(f"Created permission: {new_perm['id']}: {new_perm['name']} - {new_perm['description']}")
        
        # Verify it exists
        cursor.execute("""
            SELECT id, name, description 
            FROM permissions 
            WHERE id = %s
        """, (new_perm['id'],))
        
        verification = cursor.fetchone()
        assert verification is not None, f"Failed to verify permission with ID: {new_perm['id']}"
        assert verification['name'] == test_name, "Permission name does not match"
        
        logger.info(f"Verified permission exists: {verification['name']}")
        
        # Clean up
        cursor.execute("DELETE FROM permissions WHERE id = %s", (new_perm['id'],))
        conn.commit()

def test_permission_update(conn, perm_id):
    """Test updating a permission."""
    updated_description = f"Updated description at {time.time()}"
    
    logger.info(f"Testing permission update for ID: {perm_id}")
    
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        # Update permission
        cursor.execute("""
            UPDATE permissions 
            SET description = %s
            WHERE id = %s
            RETURNING id, name, description
        """, (updated_description, perm_id))
        
        updated_perm = cursor.fetchone()
        conn.commit()
        
        assert updated_perm is not None, f"Failed to update permission with ID: {perm_id}"
        assert updated_perm['description'] == updated_description, "Description was not updated correctly"
        
        logger.info(f"Updated permission: {updated_perm['id']}: {updated_perm['name']} - {updated_perm['description']}")

def test_permission_delete(conn):
    """Test deleting a permission."""
    # First create a permission to delete
    test_name = f"TO_DELETE_PERMISSION_{uuid.uuid4().hex[:8].upper()}"
    
    with conn.cursor() as cursor:
        # Create permission to delete
        cursor.execute("""
            INSERT INTO permissions (name, description)
            VALUES (%s, %s)
            RETURNING id
        """, (test_name, "Permission to be deleted"))
        
        perm_id = cursor.fetchone()[0]
        conn.commit()
        
        logger.info(f"Created permission to delete with ID: {perm_id}")
        
        # Delete permission
        cursor.execute("""
            DELETE FROM permissions
            WHERE id = %s
            RETURNING id
        """, (perm_id,))
        
        result = cursor.fetchone()
        conn.commit()
        
        assert result is not None, f"Failed to delete permission with ID: {perm_id}"
        logger.info(f"Successfully deleted permission with ID: {perm_id}")
        
        # Verify it's gone
        cursor.execute("""
            SELECT COUNT(*) 
            FROM permissions 
            WHERE id = %s
        """, (perm_id,))
        
        count = cursor.fetchone()[0]
        assert count == 0, f"Permission with ID {perm_id} still exists after deletion"
        logger.info(f"Verified permission with ID {perm_id} is gone")

def test_permission_search(conn):
    """Test searching for permissions with filters."""
    # First create some test permissions
    base_name = f"SEARCH_TEST_{uuid.uuid4().hex[:4].upper()}"
    perm_ids = []
    
    with conn.cursor() as cursor:
        # Create 3 test permissions
        for i in range(3):
            cursor.execute("""
                INSERT INTO permissions (name, description)
                VALUES (%s, %s)
                RETURNING id
            """, (f"{base_name}_{i}", f"Search test permission {i}"))
            perm_ids.append(cursor.fetchone()[0])
        
        conn.commit()
        logger.info(f"Created {len(perm_ids)} test permissions for search test")
        
        try:
            # Test searching by name pattern
            with conn.cursor(cursor_factory=RealDictCursor) as search_cursor:
                search_cursor.execute("""
                    SELECT id, name, description
                    FROM permissions
                    WHERE name LIKE %s
                    ORDER BY id
                """, (f"{base_name}%",))
                
                results = search_cursor.fetchall()
                
                assert len(results) == 3, f"Expected 3 results, got {len(results)}"
                logger.info(f"Found {len(results)} permissions matching pattern '{base_name}%'")
                
                # Test exact match
                search_cursor.execute("""
                    SELECT id, name
                    FROM permissions
                    WHERE name = %s
                """, (f"{base_name}_1",))
                
                exact_result = search_cursor.fetchone()
                assert exact_result is not None, f"Failed to find permission with exact name '{base_name}_1'"
                logger.info(f"Found permission with exact name: {exact_result['name']}")
                
                # Test with LIKE and ORDER BY
                search_cursor.execute("""
                    SELECT id, name
                    FROM permissions
                    WHERE name LIKE %s
                    ORDER BY name DESC
                    LIMIT 2
                """, (f"{base_name}%",))
                
                ordered_results = search_cursor.fetchall()
                assert len(ordered_results) == 2, "Expected 2 results for ordered search"
                assert ordered_results[0]['name'] > ordered_results[1]['name'], "Results not properly ordered"
                logger.info("Verified ordered search results")
        
        finally:
            # Clean up all test permissions
            for pid in perm_ids:
                cursor.execute("DELETE FROM permissions WHERE id = %s", (pid,))
            conn.commit()
            logger.info(f"Cleaned up {len(perm_ids)} test permissions") 