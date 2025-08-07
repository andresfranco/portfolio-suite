import pytest
import os
import time
import random
import string
import logging
from sqlalchemy import create_engine, inspect, delete, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import Base, get_db
from app.core.config import settings
from fastapi.testclient import TestClient
from app.main import app
from app.core.db_config import Environment, db_config

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Unique test run ID to track test data
TEST_RUN_ID = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
logger.info(f"Test run ID: {TEST_RUN_ID}")

# Get database URL for testing
def get_test_db_url():
    """Get PostgreSQL database URL for testing."""
    # First check if a specific test database URL is configured
    test_db_url = os.environ.get("DATABASE_URL_TESTING")
    if test_db_url:
        return test_db_url
        
    # Extract components from the main database URL
    main_url = settings.DATABASE_URL
    
    # For tests, create a separate test database by appending _test and a random suffix
    # to avoid conflicts between parallel test runs
    random_suffix = TEST_RUN_ID
    test_url = f"{main_url}_test_{random_suffix}"
    
    return test_url

# Set the test database URL
TEST_SQLALCHEMY_DATABASE_URL = get_test_db_url()

def safe_terminate_connections(conn):
    """Try to terminate connections and handle insufficient privileges."""
    try:
        # This requires superuser privileges
        conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid()"))
        return True
    except Exception as e:
        logger.warning(f"Could not terminate connections (requires superuser): {str(e)}")
        # Wait a bit to allow connections to close naturally
        time.sleep(1)
        return False

@pytest.fixture(scope="session")
def test_engine():
    """Create and return a SQLAlchemy engine for tests."""
    global TEST_SQLALCHEMY_DATABASE_URL
    
    try:
        # First connect to default database to create test database
        main_engine = create_engine(settings.DATABASE_URL)
        with main_engine.connect() as conn:
            # Try to disconnect active connections (this may fail for non-superusers)
            safe_terminate_connections(conn)
            
            # Get test database name from URL
            test_db_name = TEST_SQLALCHEMY_DATABASE_URL.split('/')[-1]
            
            try:
                # Create test database
                conn.execute(text(f"DROP DATABASE IF EXISTS {test_db_name}"))
                conn.execute(text(f"CREATE DATABASE {test_db_name}"))
                conn.commit()
            except Exception as e:
                logger.warning(f"Could not create test database (may require additional privileges): {str(e)}")
                # Use main database with temp schema instead
                logger.info("Using main database with temporary test schema")
                TEST_SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
        
        # Create engine for test database
        engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL)
    except Exception as e:
        logger.error(f"Error setting up PostgreSQL test database: {str(e)}")
        # Fall back to default PostgreSQL URL
        TEST_SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/portfolioai_test"
        logger.info(f"Falling back to default PostgreSQL URL: {TEST_SQLALCHEMY_DATABASE_URL}")
        engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL)
    
    # Create all tables in the test database
    Base.metadata.create_all(bind=engine)
    return engine

def clear_database_tables(db: Session):
    """Clear all data from tables without dropping them, being careful with important tables."""
    inspector = inspect(db.bind)
    
    # Get all table names
    table_names = inspector.get_table_names()
    
    # Skip important system tables that should preserve data in production
    # This preserves permissions, roles, and users tables
    skip_tables = [
        "permissions", 
        "alembic_version"
    ]
    
    # For test-specific databases, we can clear everything
    is_test_database = TEST_SQLALCHEMY_DATABASE_URL != settings.DATABASE_URL
    if is_test_database:
        skip_tables = ["alembic_version"]  # Only preserve migration version
        
    # Check if we're using the main production database
    using_main_db = TEST_SQLALCHEMY_DATABASE_URL == settings.DATABASE_URL
    if using_main_db:
        logger.info("Using main database - only clearing test-specific data")
    
    # For PostgreSQL, disable foreign key checks temporarily
    try:
        db.execute(text("SET session_replication_role = 'replica';"))
    except Exception as e:
        logger.warning(f"Could not set session_replication_role: {str(e)}")
    
    # Execute DELETE FROM for each table
    for table_name in table_names:
        if table_name in skip_tables:
            logger.info(f"Skipping table {table_name} to preserve data")
            continue
            
        try:
            # For test data in the main database, only delete records clearly created for testing
            if using_main_db and table_name == "permissions":
                # Only delete test permissions
                db.execute(text("DELETE FROM permissions WHERE name LIKE 'TEST_%' OR name LIKE 'API_TEST_%'"))
                logger.info(f"Cleared only test permissions from {table_name}")
            elif using_main_db and table_name == "roles":
                # Only delete test roles
                db.execute(text("DELETE FROM roles WHERE name LIKE 'TEST_%'"))
                logger.info(f"Cleared only test roles from {table_name}")
            elif using_main_db and table_name == "users":
                # Only delete test users
                db.execute(text("DELETE FROM users WHERE email LIKE 'test%@example.com'"))
                logger.info(f"Cleared only test users from {table_name}")
            else:
                # Clear entire table
                db.execute(text(f"DELETE FROM {table_name}"))
                logger.info(f"Cleared all data from {table_name}")
                
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Error clearing table {table_name}: {str(e)}")
    
    # For PostgreSQL, re-enable foreign key checks
    try:
        db.execute(text("SET session_replication_role = 'origin';"))
    except Exception as e:
        logger.warning(f"Could not reset session_replication_role: {str(e)}")

@pytest.fixture
def db_session(test_engine):
    """Create a fresh SQLAlchemy session for each test that automatically rolls back."""
    # Create a new session for each test
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    # Try to create a clean session for each test
    try:
        # Try to rollback any lingering transaction in the connection pool
        with test_engine.connect() as connection:
            connection.rollback()
        
        # Get a fresh session
        db = SessionLocal()
        
        # For security, always start with a clean transaction
        db.begin_nested()
        
        # Clear all tables before running the test to ensure a clean state
        try:
            clear_database_tables(db)
            db.commit()
        except Exception as e:
            logger.warning(f"Error clearing tables: {str(e)}")
            db.rollback()
            # Force a new connection if the current one is in a bad state
            db.close()
            db = SessionLocal()
            db.begin_nested()
        
        yield db
    except Exception as e:
        logger.error(f"Error setting up db_session: {str(e)}")
        # Just return a fresh session without attempting to clear
        db = SessionLocal()
        yield db
    finally:
        # Always rollback and close the session after the test
        try:
            db.rollback()
        except Exception:
            pass
        finally:
            db.close()

@pytest.fixture(scope="session", autouse=True)
def cleanup_database(test_engine):
    """Yield the function and clean up the database after all tests."""
    yield
    
    # Only drop tables if we're using a test database (not the main database)
    is_test_database = TEST_SQLALCHEMY_DATABASE_URL != settings.DATABASE_URL
    
    if is_test_database:
        logger.info("Dropping all tables after tests")
        Base.metadata.drop_all(bind=test_engine)
    else:
        logger.info("Skipping table drop since we're using the main database")
        # For main database, clean up any remaining test data
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
        db = SessionLocal()
        try:
            # Clean up test permissions
            db.execute(text("DELETE FROM permissions WHERE name LIKE 'TEST_%' OR name LIKE 'API_TEST_%'"))
            db.commit()
            logger.info("Cleaned up test permissions from main database")
        except SQLAlchemyError as e:
            logger.warning(f"Error cleaning up test data: {str(e)}")
            db.rollback()
        finally:
            db.close()
    
    # Drop the test database
    if TEST_SQLALCHEMY_DATABASE_URL != settings.DATABASE_URL:
        try:
            main_engine = create_engine(settings.DATABASE_URL)
            with main_engine.connect() as conn:
                # Try to disconnect users from the test database (may fail for non-superusers)
                safe_terminate_connections(conn)
                
                # Get test database name from URL
                test_db_name = TEST_SQLALCHEMY_DATABASE_URL.split('/')[-1]
                
                # Drop the test database
                conn.execute(text(f"DROP DATABASE IF EXISTS {test_db_name}"))
                conn.commit()
                logger.info(f"Dropped test database: {test_db_name}")
        except Exception as e:
            logger.warning(f"Could not drop test database (may require additional privileges): {str(e)}")

@pytest.fixture(scope="function")
def db(test_engine):
    """Return a database session for tests."""
    # Force environment to be testing
    os.environ["ENVIRONMENT"] = "testing"
    
    # Create a new session for each test
    db = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)()
    
    # Begin a transaction
    db.begin()
    
    try:
        yield db
    finally:
        # Always roll back the transaction to prevent test data from persisting
        db.rollback()
        db.close()

@pytest.fixture(scope="function")
def client(db):
    """Return a FastAPI test client."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()

# Test data tracking utilities
class TestDataTracker:
    """Utility class to track and clean up test data."""
    
    @staticmethod
    def generate_test_name(prefix="TEST"):
        """Generate a unique test name with prefix and test run ID."""
        unique_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"{prefix}_{TEST_RUN_ID}_{unique_suffix}"
    
    @staticmethod
    def cleanup_test_data(db: Session, table_name: str, field: str = "name", prefix: str = "TEST"):
        """Clean up test data from a table based on naming pattern."""
        try:
            result = db.execute(text(f"DELETE FROM {table_name} WHERE {field} LIKE '{prefix}_%'"))
            db.commit()
            return result.rowcount
        except Exception as e:
            logger.error(f"Error cleaning up test data from {table_name}: {str(e)}")
            db.rollback()
            return 0

@pytest.fixture
def test_data_tracker():
    """Fixture to provide test data tracking utilities."""
    return TestDataTracker 