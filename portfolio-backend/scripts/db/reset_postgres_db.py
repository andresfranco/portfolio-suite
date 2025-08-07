#!/usr/bin/env python3
"""
PostgreSQL Database Reset
------------------------

This script removes all records from tables in a specified database environment
while preserving the table structure.

WARNING: This is a destructive operation that will delete ALL data in the database.
Make sure you have proper backups before running this script in production environments.

Usage:
    python reset_postgres_db.py [--environment ENVIRONMENT] [--confirm CONFIRM]
    
    Options:
        --environment: The environment to run in (development, testing, staging, production)
        --confirm: Type 'YES' to confirm that you want to delete all records (required)
"""

import sys
import os
import logging
import argparse
from configparser import ConfigParser
from sqlalchemy import text, inspect, MetaData, Table

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("reset_postgres")

# Add the project root directory to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import app modules
from app.core.database import SessionLocal, engine
from app.core.db_config import db_config, Environment

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Reset database by removing all records while preserving structure")
    
    # Get available environments from alembic.ini
    config = ConfigParser()
    alembic_ini_path = os.path.join(project_root, "alembic.ini")
    environments = []
    
    if os.path.exists(alembic_ini_path):
        config.read(alembic_ini_path)
        environments = [section for section in config.sections() 
                        if section not in ['alembic', 'post_write_hooks', 'loggers', 
                                          'handlers', 'formatters', 'logger_root', 
                                          'logger_sqlalchemy', 'logger_alembic', 
                                          'handler_console', 'formatter_generic']]
    
    if not environments:
        environments = ['development', 'testing', 'staging', 'production']
    
    parser.add_argument("--environment", "-e", choices=environments, 
                        default=os.environ.get("ENVIRONMENT", "development"),
                        help=f"Environment to run in (choices: {', '.join(environments)})")
    
    parser.add_argument("--confirm", required=True,
                      help="Type 'YES' (all caps) to confirm that you want to delete all records")
    
    return parser.parse_args()

def set_environment(env_name):
    """Set the environment for database operations."""
    # Convert environment name to internal Environment enum
    env_map = {
        'development': Environment.DEVELOPMENT,
        'testing': Environment.TESTING,
        'staging': Environment.STAGING,
        'production': Environment.PRODUCTION,
    }
    
    # Set environment variable
    actual_env = env_map.get(env_name.lower(), Environment.DEVELOPMENT)
    os.environ["ENVIRONMENT"] = actual_env.value
    
    logger.info(f"Setting environment to: {actual_env.value}")
    
    # Re-initialize database configuration to pick up environment changes
    from importlib import reload
    from app.core import db_config as db_config_module
    reload(db_config_module)
    global db_config
    db_config = db_config_module.db_config
    
    logger.info(f"Using database: {db_config.current_environment}")
    return actual_env

def get_all_tables():
    """Get all tables from the database schema."""
    metadata = MetaData()
    metadata.reflect(bind=engine)
    
    # Get a list of all tables
    tables = list(metadata.sorted_tables)
    
    # Return them in an order that respects foreign key constraints
    # (children before parents, so we can delete from children first)
    return reversed(tables)

def reset_database():
    """Reset the database by truncating all tables."""
    db = SessionLocal()
    try:
        # Get all tables in proper order
        tables = get_all_tables()
        
        # Temporarily disable foreign key constraints
        db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        
        # Count tables affected
        tables_affected = 0
        
        # Truncate tables
        for table in tables:
            # Skip alembic_version table
            if table.name == 'alembic_version':
                continue
                
            # Delete all records from the table
            db.execute(text(f"TRUNCATE TABLE {table.name} CASCADE"))
            tables_affected += 1
            logger.info(f"Truncated table: {table.name}")
        
        # Commit the transaction
        db.commit()
        
        logger.info(f"Reset completed. {tables_affected} tables were truncated.")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting database: {str(e)}")
        return False
    finally:
        db.close()

def main(args):
    """Main function to reset the database."""
    # Verify confirmation
    if args.confirm != "YES":
        logger.error("Confirmation failed. Please type 'YES' to confirm database reset.")
        return False
    
    # Check if we're trying to reset production without extra precautions
    if args.environment.lower() == "production":
        double_check = input("\n⚠️ WARNING: You are about to DELETE ALL DATA in the PRODUCTION database! ⚠️\n"
                            "This action cannot be undone. Type 'I UNDERSTAND THE CONSEQUENCES' to proceed: ")
        if double_check != "I UNDERSTAND THE CONSEQUENCES":
            logger.error("Production database reset aborted by user.")
            return False
    
    # Set environment and initialize connections
    set_environment(args.environment)
    
    # Show a warning about what we're about to do
    logger.warning(f"🚨 Preparing to DELETE ALL DATA from the {args.environment} database!")
    logger.warning(f"Database URL: {db_config.url}")
    
    # Ask for final confirmation with a 5-second countdown
    import time
    for i in range(5, 0, -1):
        logger.warning(f"Database reset will begin in {i} seconds... Press Ctrl+C to abort.")
        time.sleep(1)
    
    # Reset the database
    if reset_database():
        logger.info(f"✅ Database in environment '{args.environment}' has been reset successfully.")
        return True
    else:
        logger.error(f"❌ Failed to reset database in environment '{args.environment}'.")
        return False

if __name__ == "__main__":
    args = parse_arguments()
    if main(args):
        sys.exit(0)
    else:
        sys.exit(1)