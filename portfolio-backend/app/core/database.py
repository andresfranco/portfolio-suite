from sqlalchemy import create_engine, event, pool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.db_config import db_config
from app.core.config import settings
from app.core.logging import setup_logger
import os
import logging

# Set up logger for the database module
logger = setup_logger("app.core.database")

# Use the environment-specific DATABASE_URL
SQLALCHEMY_DATABASE_URL = db_config.url
logger.debug(f"Database URL resolved for environment '{db_config.current_environment}': {db_config.url}")

# Build engine configuration based on environment
engine_config = {
    "pool_size": settings.DB_POOL_SIZE,
    "max_overflow": settings.DB_MAX_OVERFLOW,
    "pool_timeout": settings.DB_POOL_TIMEOUT,
    "pool_pre_ping": True,  # Verify connections before using them
    "pool_recycle": 3600,  # Recycle connections after 1 hour
}

# Add SSL configuration if enabled
connect_args = {}
if settings.DB_SSL_ENABLED:
    connect_args["sslmode"] = settings.DB_SSL_MODE
    logger.info(f"Database SSL enabled with mode: {settings.DB_SSL_MODE}")
    
    # In production, enforce SSL verification
    if settings.is_production() and settings.DB_SSL_MODE in ["verify-ca", "verify-full"]:
        # These would be set via environment variables
        ssl_ca = os.getenv("DB_SSL_CA_CERT")
        ssl_cert = os.getenv("DB_SSL_CLIENT_CERT")
        ssl_key = os.getenv("DB_SSL_CLIENT_KEY")
        
        if ssl_ca:
            connect_args["sslrootcert"] = ssl_ca
        if ssl_cert:
            connect_args["sslcert"] = ssl_cert
        if ssl_key:
            connect_args["sslkey"] = ssl_key

if connect_args:
    engine_config["connect_args"] = connect_args

# Use NullPool for testing to avoid connection reuse issues
if settings.is_testing():
    engine_config["poolclass"] = pool.NullPool
    logger.info("Using NullPool for testing environment")

# Configure PostgreSQL database connection
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_config
)

# Add connection event listeners for enhanced security and monitoring
@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """
    Event listener called when a new database connection is created.
    Used for logging and security enforcement.
    """
    if settings.is_development():
        logger.debug("New database connection established")
    
    # Set connection-level parameters for security
    cursor = dbapi_conn.cursor()
    
    # Set statement timeout to prevent long-running queries
    # 30 seconds in production, 60 in development
    timeout_ms = 30000 if settings.is_production() else 60000
    cursor.execute(f"SET statement_timeout = {timeout_ms}")
    
    # Set timezone to UTC for consistency
    cursor.execute("SET timezone = 'UTC'")
    
    cursor.close()

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """
    Event listener called when a connection is checked out from the pool.
    Used for connection validation and monitoring.
    """
    if settings.is_development() and settings.LOG_SQL:
        logger.debug("Database connection checked out from pool")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Use import from sqlalchemy.orm instead of sqlalchemy.ext.declarative
from sqlalchemy.orm import declarative_base
Base = declarative_base()

def get_db():
    """Get a database session for dependency injection.
    
    This function provides a database session to FastAPI endpoints
    via dependency injection. It ensures proper cleanup of
    resources after use.
    
    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database for the current environment.
    
    This function creates all tables defined in SQLAlchemy models.
    It should be called at application startup.
    """
    # Import models here to avoid circular imports
    from app.models import (
        user, role, permission, category_type, skill_type,
        portfolio, project, section, skill, category,
        experience, language, translation
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info(f"PostgreSQL database tables initialized for environment: {db_config.current_environment}")
    
    # Log database specifics
    if db_config.is_production:
        logger.info("Running with PRODUCTION database")
    elif db_config.is_development:
        logger.info("Running with DEVELOPMENT database")
    elif db_config.is_testing:
        logger.info("Running with TESTING database")