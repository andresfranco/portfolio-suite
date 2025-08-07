#!/usr/bin/env python3
"""
PostgreSQL Database Initialization Script
----------------------------------------

This script initializes PostgreSQL databases for different environments:
- Creates databases for each environment in alembic.ini if they don't exist
- Sets up proper permissions for the admindb user
- Populates newly created databases with initial data

Usage:
    python scripts/db/db_init.py [--env ENV]

Arguments:
    --env ENV    Environment to initialize (specific environment name or 'all'). Default: all
"""

import sys
import os
import argparse
import logging
import subprocess
from configparser import ConfigParser
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse, unquote
import importlib.util
import re
import getpass

# Add the parent directory to sys.path to access app modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("db_init")

# Import app config modules
from app.core.db_config import Environment, db_config
from app.core.config import settings

def get_environments_from_alembic():
    """Get all environment sections from alembic.ini."""
    config = ConfigParser()
    alembic_ini_path = os.path.join(project_root, "alembic.ini")
    environments = []
    
    if (os.path.exists(alembic_ini_path)):
        config.read(alembic_ini_path)
        environments = [section for section in config.sections() 
                      if section not in ['alembic', 'post_write_hooks', 'loggers', 
                                        'handlers', 'formatters', 'logger_root', 
                                        'logger_sqlalchemy', 'logger_alembic', 
                                        'handler_console', 'formatter_generic']]
    
    if not environments:
        environments = ['development', 'testing', 'staging', 'production']
    
    logger.info(f"Found environments in alembic.ini: {', '.join(environments)}")
    return environments

def parse_arguments():
    """Parse command line arguments."""
    environments = get_environments_from_alembic()
    
    parser = argparse.ArgumentParser(description="Initialize PostgreSQL database environments")
    parser.add_argument(
        "--env", 
        choices=environments + ["all"],
        default="all", 
        help=f"Environment to initialize (choices: {', '.join(environments)} or all)"
    )
    
    # Get init_postgres_db.py parameters
    parser.add_argument(
        "--username", 
        default="systemadmin",
        help="Username for the admin user"
    )
    parser.add_argument(
        "--password", 
        default="Password$",
        help="Password for the admin user"
    )
    parser.add_argument(
        "--email", 
        default="admin@amfapps.com",
        help="Email for the admin user"
    )
    
    # Add admindb password parameter
    parser.add_argument(
        "--admindb-password",
        help="Password for the admindb database user (if not provided, will use ADMINDB_PASSWORD environment variable)"
    )
    
    return parser.parse_args()

def parse_db_url(url):
    """Parse database URL into components."""
    parsed = urlparse(url)
    return {
        "dbname": parsed.path.strip('/'),
        "user": unquote(parsed.username) if parsed.username else None,
        "password": unquote(parsed.password) if parsed.password else None,
        "host": parsed.hostname,
        "port": parsed.port or 5432
    }

def get_postgres_connection(dbname='postgres'):
    """Get a connection to PostgreSQL server (not a specific database)."""
    try:
        # First try to connect as postgres superuser (should always exist)
        params = {
            'dbname': 'postgres',
            'user': 'postgres',
            'host': 'localhost',
            'port': 5432
        }
        
        # Try with empty password first (common in local dev environments)
        try:
            logger.info(f"Attempting to connect to PostgreSQL as postgres superuser without password")
            conn = psycopg2.connect(**params)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            logger.info(f"Connected to PostgreSQL as postgres superuser (no password)")
            return conn
        except psycopg2.OperationalError:
            # If that fails, try with default password
            params['password'] = 'postgres'  # Default postgres password in many installations
            try:
                logger.info(f"Attempting to connect to PostgreSQL as postgres superuser with default password")
                conn = psycopg2.connect(**params)
                conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                logger.info(f"Connected to PostgreSQL as postgres superuser (default password)")
                return conn
            except psycopg2.OperationalError:
                # If still fails, prompt for password
                logger.info("Default postgres password didn't work, trying with prompted password")
                for _ in range(3):  # Try 3 times
                    try:
                        password = getpass.getpass("Enter password for PostgreSQL superuser 'postgres': ")
                        params['password'] = password
                        conn = psycopg2.connect(**params)
                        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                        logger.info(f"Connected to PostgreSQL as postgres superuser (custom password)")
                        return conn
                    except psycopg2.OperationalError as e:
                        logger.warning(f"Connection failed: {str(e)}")
                        print("Invalid password. Please try again.")
                
                # If all attempts with postgres user failed, log the error
                logger.warning("All connection attempts as postgres superuser failed")
                
    except Exception as e:
        logger.warning(f"Could not connect as postgres superuser: {str(e)}")
    
    # Fall back to using admindb user from DATABASE_URL
    logger.info("Falling back to admindb user from DATABASE_URL...")
    try:
        # Parse the DATABASE_URL to get connection parameters
        db_url = settings.DATABASE_URL
        parsed = parse_db_url(db_url)
        
        # Use the parsed connection parameters
        params = {
            'dbname': dbname,
            'user': parsed['user'],
            'password': parsed['password'],
            'host': parsed['host'],
            'port': parsed['port']
        }
        
        logger.info(f"Connecting to PostgreSQL server at {params['host']}:{params['port']} as {params['user']}")
        conn = psycopg2.connect(**params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        logger.info(f"Connected to PostgreSQL server at {params['host']}:{params['port']} as {params['user']}")
        return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Error connecting to PostgreSQL: {str(e)}")
        raise

def database_exists(conn, dbname):
    """Check if a database exists."""
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
        return cursor.fetchone() is not None

def create_database(conn, dbname):
    """Create a new database if it doesn't exist."""
    if database_exists(conn, dbname):
        logger.info(f"Database '{dbname}' already exists")
        
        # Even for existing databases, make sure admindb is the owner
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"ALTER DATABASE {dbname} OWNER TO admindb")
                logger.info(f"Changed ownership of existing database '{dbname}' to admindb")
        except Exception as e:
            logger.warning(f"Could not change owner of existing database '{dbname}': {str(e)}")
            
        return False
        
    try:
        with conn.cursor() as cursor:
            # Create database with appropriate encoding and locale settings for international character support
            # Using C.UTF-8 locale for better language-neutral sorting and comparison
            create_query = f"""
            CREATE DATABASE {dbname}
            WITH 
                ENCODING = 'UTF8'
                LC_COLLATE = 'C' 
                LC_CTYPE = 'C'
                TEMPLATE = template0
                CONNECTION LIMIT = -1;
            """
            cursor.execute(create_query)
            logger.info(f"Database '{dbname}' created successfully with international character support")
            
            # After creation, immediately set admindb as the owner
            try:
                cursor.execute(f"ALTER DATABASE {dbname} OWNER TO admindb")
                logger.info(f"Changed ownership of new database '{dbname}' to admindb")
            except Exception as e:
                logger.warning(f"Could not change owner of new database '{dbname}': {str(e)}")
            
            # Configure additional settings for improved multilingual support
            # Connect to the new database to set specific parameters
            conn_new_db = psycopg2.connect(
                dbname=dbname,
                user=conn.info.user,
                password=conn.info.password,
                host=conn.info.host,
                port=conn.info.port
            )
            conn_new_db.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn_new_db.cursor() as db_cursor:
                # Change ownership of the public schema to admindb
                try:
                    db_cursor.execute("ALTER SCHEMA public OWNER TO admindb")
                    logger.info(f"Changed ownership of schema public to admindb")
                except Exception as e:
                    logger.warning(f"Could not change schema ownership: {str(e)}")
                
                # Set text search configuration for multiple languages
                db_cursor.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
                
                # Ensure proper Unicode case handling
                db_cursor.execute("SET client_encoding = 'UTF8';")
                
                # Check if ICU extension is available (for advanced collation capabilities)
                try:
                    db_cursor.execute("CREATE EXTENSION IF NOT EXISTS icu;")
                    logger.info(f"ICU extension enabled for advanced multilingual collation")
                except Exception as e:
                    logger.warning(f"ICU extension not available on this PostgreSQL instance: {e}")
            
            conn_new_db.close()
            return True
    except Exception as e:
        logger.error(f"Error creating database '{dbname}': {str(e)}")
        raise

def grant_permissions(conn, dbname, admindb_password=None):
    """Grant appropriate permissions to admindb user for the database."""
    try:
        with conn.cursor() as cursor:
            # Check if user exists
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", ('admindb',))
            user_exists = cursor.fetchone() is not None
            
            if not user_exists:
                # User doesn't exist - create it with the provided password
                logger.info("User 'admindb' does not exist in PostgreSQL. Creating user...")
                
                # Ensure we have a valid password to use
                if not admindb_password:
                    # Try to get from environment variable
                    admindb_password = os.environ.get("ADMINDB_PASSWORD")
                    
                    if not admindb_password:
                        # This is a fallback that should never happen if the script is run correctly
                        logger.error("No admindb password provided and ADMINDB_PASSWORD environment variable not set")
                        raise ValueError("Missing admindb password. Please set ADMINDB_PASSWORD or use --admindb-password")
                
                # Validate password strength
                if not validate_password_strength(admindb_password):
                    logger.error("The admindb password is not strong enough")
                    raise ValueError("Password must be at least 10 characters with upper, lower, digits and special chars")
                
                # Create the user with the secure password
                cursor.execute("CREATE USER admindb WITH PASSWORD %s", (admindb_password,))
                
                # Grant createdb permission to the new user
                cursor.execute("ALTER USER admindb WITH CREATEDB")
                logger.info("User 'admindb' created successfully with CREATEDB permission")
            else:
                logger.info("User 'admindb' already exists, using existing user")
            
            # Rest of the function remains the same...
            # Grant database-level privileges (connect to the database)
            cursor.execute(f"GRANT CONNECT ON DATABASE {dbname} TO admindb")
            
            # Connect to the specific database to grant schema-level permissions
            conn_db = psycopg2.connect(
                dbname=dbname,
                user=conn.info.user,
                password=conn.info.password,
                host=conn.info.host,
                port=conn.info.port
            )
            conn_db.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            
            with conn_db.cursor() as db_cursor:
                # Grant usage on schema public
                db_cursor.execute("GRANT USAGE ON SCHEMA public TO admindb")
                logger.info(f"Granted USAGE privilege on schema public to admindb")
                
                # Grant privileges on future objects
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO admindb")
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO admindb")
                logger.info(f"Set default privileges for future objects in '{dbname}' for admindb")
                
                # Grant privileges on existing objects (if any already exist)
                try:
                    db_cursor.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admindb")
                    db_cursor.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO admindb")
                    logger.info(f"Granted privileges on existing objects in schema public to admindb")
                except Exception as e:
                    logger.warning(f"Note: Could not grant permissions on existing objects (may not exist yet): {str(e)}")
            
            conn_db.close()
            logger.info(f"Granted database-level privileges on '{dbname}' to user 'admindb'")
            
            return True
    except Exception as e:
        logger.error(f"Error granting permissions for database '{dbname}': {str(e)}")
        # Don't fail the entire process for permission issues
        return True

def grant_permissions_on_all_objects(conn, dbname):
    """Grant specific permissions on all database objects to admindb user."""
    try:
        # Connect to the specific database as the superuser/admin
        conn_db = psycopg2.connect(
            dbname=dbname,
            user=conn.info.user,
            password=conn.info.password,
            host=conn.info.host,
            port=conn.info.port
        )
        conn_db.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        with conn_db.cursor() as db_cursor:
            # Check if we're already a superuser
            db_cursor.execute("SELECT usesuper FROM pg_user WHERE usename = current_user")
            is_superuser = db_cursor.fetchone()[0]
            
            # If superuser, try to change object ownership instead of just granting permissions
            if is_superuser:
                try:
                    logger.info(f"Connected as superuser, attempting to change ownership of objects in '{dbname}'")
                    # Change ownership of tables (including alembic_version)
                    db_cursor.execute("""
                        DO $$
                        DECLARE
                            tbl RECORD;
                        BEGIN
                            FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
                            LOOP
                                EXECUTE format('ALTER TABLE public.%I OWNER TO admindb', tbl.tablename);
                                RAISE NOTICE 'Changed ownership of table % to admindb', tbl.tablename;
                            END LOOP;
                        END
                        $$;
                    """)
                    
                    # Change ownership of sequences
                    db_cursor.execute("""
                        DO $$
                        DECLARE
                            seq RECORD;
                        BEGIN
                            FOR seq IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
                            LOOP
                                EXECUTE format('ALTER SEQUENCE public.%I OWNER TO admindb', seq.sequence_name);
                            END LOOP;
                        END
                        $$;
                    """)
                    
                    # Change ownership of schema
                    db_cursor.execute("ALTER SCHEMA public OWNER TO admindb;")
                    
                    logger.info(f"Successfully changed ownership of all objects in '{dbname}' to admindb")
                except Exception as e:
                    logger.warning(f"Error changing ownership: {str(e)}")
            
            # Grant specific CRUD permissions on existing tables - this is a fallback
            try:
                # Grant ALL on schema level
                db_cursor.execute("GRANT ALL ON SCHEMA public TO admindb")
                
                # Grant ALL on all tables 
                db_cursor.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admindb")
                logger.info(f"Granted ALL privileges on all tables in '{dbname}' to admindb")
                
                # Grant ALL on all sequences
                db_cursor.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admindb")
                logger.info(f"Granted ALL privileges on all sequences in '{dbname}' to admindb")
                
                # Grant ALL on all functions
                db_cursor.execute("GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admindb")
                logger.info(f"Granted ALL privileges on all functions in '{dbname}' to admindb")
            except Exception as e:
                logger.warning(f"Error granting ALL privileges: {str(e)}")
                
                # Try more specific permissions if ALL failed
                try:
                    # Grant SELECT, INSERT, UPDATE, DELETE on all tables
                    db_cursor.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admindb")
                    logger.info(f"Granted CRUD permissions on all tables in '{dbname}' to admindb")
                    
                    # Grant USAGE, SELECT, UPDATE on sequences
                    db_cursor.execute("GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO admindb")
                    logger.info(f"Granted permissions on all sequences in '{dbname}' to admindb")
                    
                    # Grant EXECUTE on functions
                    db_cursor.execute("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO admindb")
                    logger.info(f"Granted EXECUTE permission on all functions in '{dbname}' to admindb")
                except Exception as ex:
                    logger.warning(f"Error granting specific permissions: {str(ex)}")
            
            # Set default privileges for future objects
            try:
                # Grant ALL privileges for future objects
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO admindb")
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO admindb")
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO admindb")
                db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TYPES TO admindb")
                
                logger.info(f"Set default ALL privileges for future objects in '{dbname}'")
            except Exception as e:
                logger.warning(f"Could not set default ALL privileges: {str(e)}")
                
                # Fallback to more specific privileges
                try:
                    # Set default CRUD privileges for future tables
                    db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO admindb")
                    # Set default privileges for future sequences
                    db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO admindb")
                    # Set default privileges for future functions
                    db_cursor.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO admindb")
                    
                    logger.info(f"Set default CRUD privileges for future objects in '{dbname}'")
                except Exception as ex:
                    logger.warning(f"Could not set default specific privileges: {str(ex)}")
            
            # Try to fix alembic_version table specifically
            try:
                # Check if we can directly change ownership of alembic_version
                db_cursor.execute("""
                    DO $$
                    BEGIN
                        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'alembic_version' AND schemaname = 'public') THEN
                            EXECUTE 'ALTER TABLE public.alembic_version OWNER TO admindb';
                            RAISE NOTICE 'Changed ownership of alembic_version to admindb';
                        END IF;
                    END $$;
                """)
                logger.info(f"Successfully fixed alembic_version table permissions")
            except Exception as e:
                logger.warning(f"Could not change ownership of alembic_version: {str(e)}")
        
        conn_db.close()
        logger.info(f"Successfully set up permissions for admindb on database '{dbname}'")
        return True
    except Exception as e:
        logger.error(f"Error during permission setup: {str(e)}")
        return False

def get_db_url_for_environment(env):
    """Get the database URL for a specific environment from alembic.ini."""
    config = ConfigParser()
    alembic_ini_path = os.path.join(project_root, "alembic.ini")
    
    if not os.path.exists(alembic_ini_path):
        logger.error(f"alembic.ini file not found at {alembic_ini_path}")
        return None
    
    config.read(alembic_ini_path)
    
    if env not in config.sections():
        logger.error(f"Environment '{env}' not found in alembic.ini")
        return None
    
    # Get the sqlalchemy.url property from the environment section
    if 'sqlalchemy.url' in config[env]:
        return config[env]['sqlalchemy.url']
    else:
        logger.error(f"No sqlalchemy.url found for environment '{env}' in alembic.ini")
        return None

def detect_virtual_env():
    """Detect the virtual environment path."""
    # Check if we're already in a virtual environment
    if sys.prefix != sys.base_prefix:
        # We're already in a virtual environment
        return sys.prefix
    
    # Check common virtual environment locations
    venv_paths = [
        os.path.join(project_root, "venv"),
        os.path.join(project_root, ".venv"),
        os.path.join(project_root, "env"),
        os.path.join(os.path.expanduser("~"), ".virtualenvs", "portfolio-backend")
    ]
    
    for venv_path in venv_paths:
        activate_script = os.path.join(
            venv_path, 
            "bin" if os.name != "nt" else "Scripts", 
            "activate"
        )
        if os.path.exists(activate_script):
            return venv_path
    
    return None

def run_alembic_migrations(env, dbname):
    """Run alembic migrations for the specified environment."""
    logger.info(f"Running alembic migrations for environment: {env}")
    
    # Get virtual environment path
    venv_path = detect_virtual_env()
    if not venv_path:
        logger.warning("No virtual environment detected. Running without activation.")
        python_cmd = "python"
    else:
        # Use the venv's Python directly instead of activating the environment
        python_cmd = os.path.join(
            venv_path, 
            "bin" if os.name != "nt" else "Scripts", 
            "python"
        )
    
    # Change to project directory and run alembic with the venv's Python
    alembic_script = os.path.join(project_root, "venv", "bin", "alembic")
    
    # Check if alembic script exists, otherwise use module approach
    if os.path.exists(alembic_script):
        # Use direct alembic script
        alembic_cmd = f"cd {project_root} && {python_cmd} {alembic_script} -x environment={env} upgrade head"
    else:
        # Use module approach (more portable)
        alembic_cmd = f"cd {project_root} && {python_cmd} -m alembic -x environment={env} upgrade head"
    
    try:
        logger.info(f"Executing migrations with command: {alembic_cmd}")
        # Use shell=True because we're using cd command
        process = subprocess.run(
            alembic_cmd,
            shell=True, 
            check=True,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Log the output
        if process.stdout:
            logger.info(f"Alembic migration output: {process.stdout}")
        if process.stderr:
            logger.warning(f"Alembic migration warnings/errors: {process.stderr}")
        
        logger.info(f"Successfully ran alembic migrations for {env} database")
        return True, None
    except subprocess.CalledProcessError as e:
        error_msg = f"Failed to run alembic migrations: {e.stderr if e.stderr else str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Error running alembic migrations: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def init_environment_database(env, admin_username, admin_password, admin_email, admindb_password=None):
    """Initialize database for a specific environment."""
    logger.info(f"Initializing {env.upper()} PostgreSQL database environment")
    
    # Get the database URL for this environment
    db_url = get_db_url_for_environment(env)
    
    if not db_url:
        logger.error(f"Cannot initialize environment {env}: No database URL found")
        return False, None, "No database URL found"
    
    if not db_url.startswith('postgresql://'):
        logger.error(f"Environment {env} is not using PostgreSQL. PostgreSQL is required.")
        return False, None, "Not using PostgreSQL"
    
    # Parse the database URL
    db_params = parse_db_url(db_url)
    dbname = db_params['dbname']
    
    # Connect to the postgres database for administrative operations
    conn = get_postgres_connection()
    
    try:
        # Step 1: Create the database if it doesn't exist
        created = create_database(conn, dbname)
        
        # Step 2: Grant initial permissions to admindb user
        grant_permissions(conn, dbname, admindb_password)
        
        # Initialize database schema and data if newly created
        if created:
            # Step 3: Activate virtual environment and run alembic migrations first
            logger.info(f"Running database migrations for {env} database")
            migration_success, migration_error = run_alembic_migrations(env, dbname)
            
            if not migration_success:
                return True, dbname, f"Created but failed to run migrations: {migration_error}"
            
            # Step 4: Grant permissions on all objects created by migrations
            # This is CRITICAL - must happen AFTER migrations but BEFORE populating data
            logger.info(f"Granting CRUD permissions to admindb on all tables in {dbname}")
            if not grant_permissions_on_all_objects(conn, dbname):
                logger.error(f"Failed to grant permissions on objects in {dbname}")
                # Try one more time with a direct SQL approach
                try:
                    with conn.cursor() as cursor:
                        # Connect to the specific database
                        conn_db = psycopg2.connect(
                            dbname=dbname,
                            user=conn.info.user,
                            password=conn.info.password,
                            host=conn.info.host,
                            port=conn.info.port
                        )
                        conn_db.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                        
                        with conn_db.cursor() as db_cursor:
                            db_cursor.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admindb")
                            db_cursor.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admindb")
                            db_cursor.execute("GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admindb")
                        conn_db.close()
                        logger.info(f"Forced direct grant of ALL privileges on {dbname}")
                except Exception as direct_error:
                    logger.error(f"Direct grant also failed: {str(direct_error)}")
            
            # Step 5: Run the init_postgres_db.py script to populate data
            # IMPORTANT: Use the postgres superuser credentials to avoid permission issues
            logger.info(f"Populating initial data for {env} database")
            
            # Get virtual environment path
            venv_path = detect_virtual_env()
            if not venv_path:
                logger.warning("No virtual environment detected. Running without activation.")
                python_cmd = "python"
            else:
                # Use the venv's Python directly instead of activating the environment
                python_cmd = os.path.join(
                    venv_path, 
                    "bin" if os.name != "nt" else "Scripts", 
                    "python"
                )
            
            # Use the same database URL that alembic uses, with postgres superuser
            # Extract from alembic.ini to ensure consistency
            config = ConfigParser()
            alembic_ini_path = os.path.join(project_root, "alembic.ini")
            
            if os.path.exists(alembic_ini_path):
                config.read(alembic_ini_path)
                if env in config.sections() and 'sqlalchemy.url' in config[env]:
                    postgres_db_url = config[env]['sqlalchemy.url']
                    logger.info(f"Using database URL from alembic.ini [{env}] section")
                else:
                    # Fallback if not found in alembic.ini
                    parsed = parse_db_url(settings.DATABASE_URL)
                    postgres_db_url = f"postgresql://{parsed['user']}:{parsed['password']}@{parsed['host']}:{parsed['port']}/{dbname}"
                    logger.info(f"Using fallback database URL for {env}")
            else:
                # Fallback if alembic.ini doesn't exist
                parsed = parse_db_url(settings.DATABASE_URL)
                postgres_db_url = f"postgresql://{parsed['user']}:{parsed['password']}@{parsed['host']}:{parsed['port']}/{dbname}"
                logger.info(f"Using fallback database URL for {env} (no alembic.ini)")
                    
            # Build the full command with the venv's Python and explicit environment variables
            init_script_path = os.path.join(project_root, "scripts", "db", "init_postgres_db.py")
            
            # Set environment variables explicitly using the postgres superuser credentials
            env_vars = {
                'ENVIRONMENT': env,
                'DATABASE_URL': postgres_db_url,
                f'DATABASE_URL_{env.upper()}': postgres_db_url
            }
            
            # Log the masked URL for debugging (don't show password)
            masked_url = postgres_db_url.replace(parsed['password'] if 'parsed' in locals() else "password", "********")
            logger.info(f"Using database URL for {env}: {masked_url}")
            
            # Command without additional environment prefix to avoid conflicts
            init_cmd = (
                f"cd {project_root} && {python_cmd} {init_script_path} "
                f"--environment {env} --username {admin_username} "
                f"--password {admin_password} --email {admin_email}"
            )
            
            try:
                logger.info(f"Running command with environment {env}: {init_cmd}")
                logger.info(f"Using environment variables: ENVIRONMENT={env}, DATABASE_URL_{env.upper()}=<masked>")
                
                # Use shell=True because we're using cd command
                process = subprocess.run(
                    init_cmd,
                    shell=True,
                    check=True,
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE,
                    text=True,
                    env={**os.environ, **env_vars}  # Merge with existing environment but override specific vars
                )
                
                # Log the output
                if process.stdout:
                    logger.info(f"Init script output: {process.stdout}")
                
                # Check stderr for actual errors vs. info/debug messages
                if process.stderr:
                    stderr_lower = process.stderr.lower()
                    # Only treat as error if stderr contains error/exception keywords
                    # and doesn't contain success messages
                    if (("error" in stderr_lower or "exception" in stderr_lower or "traceback" in stderr_lower) 
                        and "successfully" not in stderr_lower and "success" not in stderr_lower):
                        logger.error(f"Init script errors: {process.stderr}")
                        return True, dbname, f"Created but failed to populate: {process.stderr}"
                    else:
                        # Otherwise, it's likely just INFO/DEBUG messages being sent to stderr
                        logger.info(f"Init script diagnostic messages: {process.stderr}")
                
                logger.info(f"Successfully initialized {env} database")
            except subprocess.CalledProcessError as e:
                error_msg = f"Failed to run init_postgres_db.py: {e.stderr if e.stderr else str(e)}"
                logger.error(error_msg)
                return True, dbname, f"Created but failed to populate: {error_msg}"
            except Exception as e:
                error_msg = f"Error running init_postgres_db.py: {str(e)}"
                logger.error(error_msg)
                return True, dbname, f"Created but failed to populate: {error_msg}"
            
            # Step 6: Final permissions update to ensure admindb can access everything
            logger.info(f"Final permissions update for admindb on all objects in {dbname}")
            grant_permissions_on_all_objects(conn, dbname)
            
            # CRITICAL FIX: Force direct permission grant on tables after everything is done
            try:
                # Connect directly to the database with postgres superuser
                conn_direct = psycopg2.connect(
                    dbname=dbname,
                    user=conn.info.user,
                    password=conn.info.password,
                    host=conn.info.host,
                    port=conn.info.port
                )
                conn_direct.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                
                with conn_direct.cursor() as cursor:
                    # Get list of all tables in the database
                    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    for table in tables:
                        # Grant permissions explicitly on each table
                        try:
                            cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.{table} TO admindb")
                            logger.info(f"Explicitly granted CRUD access on table {table} to admindb")
                        except Exception as table_err:
                            logger.warning(f"Could not grant permissions on table {table}: {str(table_err)}")
                    
                    # Get list of all sequences in the database
                    cursor.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'")
                    sequences = [row[0] for row in cursor.fetchall()]
                    
                    for sequence in sequences:
                        # Grant permissions explicitly on each sequence
                        try:
                            cursor.execute(f"GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.{sequence} TO admindb")
                            logger.info(f"Explicitly granted access on sequence {sequence} to admindb")
                        except Exception as seq_err:
                            logger.warning(f"Could not grant permissions on sequence {sequence}: {str(seq_err)}")
                
                conn_direct.close()
                logger.info("Completed explicit permission grants for all tables and sequences")
            except Exception as direct_error:
                logger.error(f"Direct table permission grant failed: {str(direct_error)}")
        else:
            # For existing databases, ensure admindb has permissions on all tables
            logger.info(f"Updating permissions for admindb on all tables in existing database {dbname}")
            grant_permissions_on_all_objects(conn, dbname)
            
            # CRITICAL FIX: Also apply direct permissions for existing databases
            try:
                # Connect directly to the database with postgres superuser
                conn_direct = psycopg2.connect(
                    dbname=dbname,
                    user=conn.info.user,
                    password=conn.info.password,
                    host=conn.info.host,
                    port=conn.info.port
                )
                conn_direct.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                
                with conn_direct.cursor() as cursor:
                    # Get list of all tables in the database
                    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
                    tables = [row[0] for row in cursor.fetchall()]
                    
                    for table in tables:
                        # Grant permissions explicitly on each table
                        try:
                            cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.{table} TO admindb")
                            logger.info(f"Explicitly granted CRUD access on table {table} to admindb")
                        except Exception as table_err:
                            logger.warning(f"Could not grant permissions on table {table}: {str(table_err)}")
                    
                    # Get list of all sequences in the database
                    cursor.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'")
                    sequences = [row[0] for row in cursor.fetchall()]
                    
                    for sequence in sequences:
                        # Grant permissions explicitly on each sequence
                        try:
                            cursor.execute(f"GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.{sequence} TO admindb")
                            logger.info(f"Explicitly granted access on sequence {sequence} to admindb")
                        except Exception as seq_err:
                            logger.warning(f"Could not grant permissions on sequence {sequence}: {str(seq_err)}")
                
                conn_direct.close()
                logger.info("Completed explicit permission grants for all tables and sequences")
            except Exception as direct_error:
                logger.error(f"Direct table permission grant failed: {str(direct_error)}")
        
        # Return success status, database name, and status message
        status_msg = "Created, migrated, and populated" if created else "Already existed (permissions updated)"
        return True, dbname, status_msg
    except Exception as e:
        logger.error(f"Error initializing database for {env}: {str(e)}")
        return False, dbname, f"Error: {str(e)}"
    finally:
        conn.close()

def fix_admindb_permissions_directly(dbname):
    """Fix permissions for admindb on an existing database."""
    logger.info(f"Ensuring admindb is the owner of database '{dbname}'")
    
    try:
        # Get superuser connection
        conn = get_postgres_connection()
        
        # First check if the database exists
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
            if cursor.fetchone() is None:
                logger.warning(f"Database '{dbname}' does not exist, cannot fix permissions")
                conn.close()
                return False
        
        # Check if admindb user exists
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", ('admindb',))
            if cursor.fetchone() is None:
                logger.warning(f"Role 'admindb' does not exist, cannot fix permissions")
                conn.close()
                return False
        
        # Check current owner
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT pg_get_userbyid(datdba) AS owner
                FROM pg_database 
                WHERE datname = %s
            """, (dbname,))
            result = cursor.fetchone()
            current_owner = result[0] if result else None
            
            if current_owner == 'admindb':
                logger.info(f"Database '{dbname}' is already owned by admindb")
            else:
                logger.info(f"Database '{dbname}' is currently owned by '{current_owner}', changing to admindb")
                # Change the owner
                cursor.execute(f"ALTER DATABASE {dbname} OWNER TO admindb")
                logger.info(f"Successfully changed owner of database '{dbname}' to admindb")
        
        # Fix schema ownership too
        conn_db = psycopg2.connect(
            dbname=dbname,
            user=conn.info.user,
            password=conn.info.password,
            host=conn.info.host,
            port=conn.info.port
        )
        conn_db.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        with conn_db.cursor() as db_cursor:
            # Make admindb the owner of the public schema
            try:
                db_cursor.execute("ALTER SCHEMA public OWNER TO admindb")
                logger.info(f"Changed ownership of schema public to admindb in database '{dbname}'")
            except Exception as e:
                logger.warning(f"Could not change schema ownership in database '{dbname}': {str(e)}")
        
        conn_db.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error fixing permissions for database '{dbname}': {str(e)}")
        return False

def fix_existing_database_ownership():
    """Specifically fix any existing database ownership issues."""
    logger.info("Checking and fixing ownership of existing portfolio databases")
    
    try:
        # Get superuser connection
        conn = get_postgres_connection()
        
        # List of portfolio databases to check
        databases = ['portfolioai_dev', 'portfolioai_test', 'portfolioai_staging', 'portfolioai']
        
        with conn.cursor() as cursor:
            # First, check if admindb role exists
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", ('admindb',))
            if cursor.fetchone() is None:
                logger.error("The admindb role doesn't exist. Cannot fix database ownership.")
                conn.close()
                return False
            
            # Check each database
            for dbname in databases:
                # Check if the database exists
                cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
                if cursor.fetchone() is None:
                    logger.info(f"Database '{dbname}' does not exist, skipping")
                    continue
                
                # Check current owner
                cursor.execute("""
                    SELECT pg_get_userbyid(datdba) AS owner
                    FROM pg_database 
                    WHERE datname = %s
                """, (dbname,))
                current_owner = cursor.fetchone()[0]
                
                if current_owner == 'admindb':
                    logger.info(f"Database '{dbname}' is already owned by admindb")
                else:
                    logger.info(f"Database '{dbname}' is owned by '{current_owner}', changing to admindb")
                    # Change the owner
                    cursor.execute(f"ALTER DATABASE {dbname} OWNER TO admindb")
                    logger.info(f"Successfully changed owner of database '{dbname}' to admindb")
        
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error fixing database ownership: {str(e)}")
        return False

def validate_password_strength(password):
    """Validate that a password meets minimum security requirements."""
    if not password or len(password) < 10:
        return False
    
    # Check for uppercase, lowercase, digits, and special characters
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    
    return has_upper and has_lower and has_digit and has_special

def get_admindb_password(args):
    """Get the admindb password from arguments or environment variables, with validation."""
    # First try to get from command line arguments
    password = args.admindb_password
    
    # If not provided in args, try environment variable
    if not password:
        password = os.environ.get("ADMINDB_PASSWORD")
    
    # If still not available, prompt the user
    if not password:
        import getpass
        print("\nThe admindb user does not exist and needs to be created.")
        print("Please provide a secure password for the admindb database user.")
        print("Requirements: At least 10 characters, with uppercase, lowercase, numbers, and special characters.")
        password = getpass.getpass("Enter admindb password: ")
    
    # Validate password strength
    if not validate_password_strength(password):
        logger.error("The provided admindb password is not strong enough. It must:")
        logger.error("- Be at least 10 characters long")
        logger.error("- Contain at least one uppercase letter")
        logger.error("- Contain at least one lowercase letter")
        logger.error("- Contain at least one number")
        logger.error("- Contain at least one special character")
        sys.exit(1)
    
    return password

def main():
    """Main function to run the script."""
    args = parse_arguments()
    
    # Verify PostgreSQL is configured
    if not settings.DATABASE_URL.startswith('postgresql://'):
        logger.error("PostgreSQL database URL is required. Please check your .env file.")
        sys.exit(1)
    
    # Get admindb password (only if needed for user creation)
    admindb_password = None
    
    # Check if admindb user exists before prompting for password
    conn = get_postgres_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", ('admindb',))
            admindb_exists = cursor.fetchone() is not None
        
        if not admindb_exists:
            admindb_password = get_admindb_password(args)
    finally:
        conn.close()
    
    # Determine which environments to initialize
    environments = []
    if args.env == 'all':
        environments = get_environments_from_alembic()
    else:
        environments = [args.env]
    
    # Initialize each environment and track results
    success_count = 0
    database_results = []
    
    for env in environments:
        try:
            # Pass admindb_password to each environment initialization
            success, dbname, status = init_environment_database(
                env, 
                args.username, 
                args.password, 
                args.email, 
                admindb_password
            )
            if success:
                success_count += 1
                # Apply direct permission fix for each successfully created/updated database
                fix_admindb_permissions_directly(dbname)
            database_results.append({
                'environment': env,
                'database': dbname,
                'status': status,
                'success': success
            })
        except Exception as e:
            logger.error(f"Failed to initialize {env} environment: {str(e)}")
            database_results.append({
                'environment': env,
                'database': None,
                'status': f"Error: {str(e)}",
                'success': False
            })
            continue
    
    # Print summary of database operations
    print("\n" + "="*80)
    print(" DATABASE INITIALIZATION SUMMARY ".center(80, "="))
    print("="*80)
    
    # Format and display results
    created_dbs = []
    migrated_dbs = []
    existing_dbs = []
    failed_dbs = []
    
    for result in database_results:
        env = result['environment']
        db = result['database'] or 'Unknown'
        status = result['status']
        
        if 'Created, migrated, and populated' in status:
            created_dbs.append(f"{env} ({db})")
        elif 'Created but failed' in status:
            failed_dbs.append(f"{env} ({db}): {status}")
        elif 'Already existed' in status:
            existing_dbs.append(f"{env} ({db})")
        else:
            failed_dbs.append(f"{env} ({db}): {status}")
    
    # Print categorized results
    if created_dbs:
        print("\nDatabases created, migrated and populated:")
        for db in created_dbs:
            print(f"  ✓ {db}")
    
    if existing_dbs:
        print("\nDatabases already existed (no changes made):")
        for db in existing_dbs:
            print(f"  • {db}")
    
    if failed_dbs:
        print("\nFailed database operations:")
        for db in failed_dbs:
            print(f"  ✗ {db}")
    
    # Print overall status
    print("\nSUMMARY:")
    print(f"  Total environments: {len(environments)}")
    print(f"  Successful operations: {success_count}")
    print(f"  Created and fully configured databases: {len(created_dbs)}")
    print(f"  Existing databases (unchanged): {len(existing_dbs)}")
    print(f"  Failed operations: {len(failed_dbs)}")
    print("="*80 + "\n")
    
    # Return appropriate exit code
    if success_count == len(environments):
        logger.info("All PostgreSQL database environments were initialized successfully")
        return 0
    else:
        logger.warning(f"Initialized {success_count} out of {len(environments)} environments")
        return 1

if __name__ == "__main__":
    sys.exit(main())