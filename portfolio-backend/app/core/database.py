from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.db_config import db_config
from app.core.logging import setup_logger
import os
import logging

# Set up logger for the database module
logger = setup_logger("app.core.database")

# Use the environment-specific DATABASE_URL
SQLALCHEMY_DATABASE_URL = db_config.url
logger.debug(f"Database URL resolved for environment '{db_config.current_environment}': {db_config.url}")

# Configure PostgreSQL database connection
engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)

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