#!/usr/bin/env python3
"""
Permission PostgreSQL Test
-------------------------

This script tests the PostgreSQL connection using the DATABASE_URL
from the .env file and performs basic operations on the Permission model only.
"""
import sys
import logging
from sqlalchemy import text, inspect

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import application modules
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.models.permission import Permission

def test_connection():
    """Test the database connection."""
    logger.info(f"Testing connection to: {settings.DATABASE_URL}")
    
    try:
        # Test basic connection
        with engine.connect() as conn:
            logger.info("Connected successfully to the database")
            
            # Get database version
            if settings.DATABASE_URL.startswith('postgresql'):
                result = conn.execute(text("SELECT version()"))
                version = result.scalar()
                logger.info(f"PostgreSQL version: {version}")
            else:
                logger.info("Not using PostgreSQL")
        
        return True
    except Exception as e:
        logger.error(f"Connection failed: {str(e)}")
        return False

def test_permission_crud():
    """Test CRUD operations on the Permission model only."""
    logger.info("Testing CRUD operations on Permission model...")
    
    # Get a database session
    db = SessionLocal()
    test_passed = True
    
    try:
        # 1. List existing permissions
        logger.info("Listing existing permissions...")
        
        existing_permissions = db.query(Permission).all()
        logger.info(f"Found {len(existing_permissions)} permissions:")
        for perm in existing_permissions:
            logger.info(f"- {perm.id}: {perm.name} - {perm.description}")
        
        # 2. Create a test permission
        test_perm_name = "TEST_CONNECTION_PERMISSION"
        logger.info(f"Creating test permission: {test_perm_name}")
        
        # Check if permission already exists
        existing_perm = db.query(Permission).filter(Permission.name == test_perm_name).first()
        if existing_perm:
            logger.info(f"Permission {test_perm_name} already exists, deleting first")
            db.delete(existing_perm)
            db.commit()
        
        # Create new permission
        new_perm = Permission(
            name=test_perm_name,
            description="Test permission for database connection check"
        )
        db.add(new_perm)
        db.commit()
        db.refresh(new_perm)
        
        logger.info(f"Created permission with ID: {new_perm.id}")
        
        # 3. Read the permission
        read_perm = db.query(Permission).filter(Permission.id == new_perm.id).first()
        if read_perm:
            logger.info(f"Successfully read permission: {read_perm.name} (ID: {read_perm.id})")
        else:
            logger.error("Failed to read permission")
            test_passed = False
        
        # 4. Update the permission
        read_perm.description = "Updated description for test permission"
        db.commit()
        db.refresh(read_perm)
        logger.info(f"Updated permission description: {read_perm.description}")
        
        # 5. Delete the permission
        db.delete(read_perm)
        db.commit()
        logger.info("Deleted test permission")
        
        # Verify deletion
        deleted_check = db.query(Permission).filter(Permission.id == new_perm.id).first()
        if deleted_check is None:
            logger.info("Verified deletion - permission no longer exists")
        else:
            logger.error("Failed to delete permission")
            test_passed = False
        
        return test_passed
    except Exception as e:
        logger.error(f"CRUD operations failed: {str(e)}")
        return False
    finally:
        db.close()
        logger.info("Database session closed")

def main():
    """Main function to run all tests."""
    logger.info("Starting PostgreSQL Permission tests")
    
    # Test connection
    if not test_connection():
        logger.error("Connection test failed")
        sys.exit(1)
    
    # Test CRUD operations
    if not test_permission_crud():
        logger.error("Permission CRUD tests failed")
        sys.exit(1)
    
    logger.info("All tests completed successfully!")

if __name__ == "__main__":
    main() 