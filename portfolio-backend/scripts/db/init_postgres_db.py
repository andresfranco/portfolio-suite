#!/usr/bin/env python3
"""
PostgreSQL Database Initialization
----------------------------------

This script initializes a PostgreSQL database with the standard permissions,
roles, and an initial system admin user. It should be run after
the database and tables have been created.

The script:
1. Creates standard permissions if they don't exist
2. Creates default roles with appropriate permissions
3. Creates a system admin user with the Administrator role
4. Runs in the specified environment (development, testing, staging, production)

Usage:
    python init_postgres_db.py [--environment ENVIRONMENT] [--username USERNAME] [--password PASSWORD] [--email EMAIL]
    
    Options:
        --environment: The environment to run in (development, testing, staging, production)
        --username: The username for the admin user (default: admin)
        --password: The password for the admin user (default: generated secure password)
        --email: The email for the admin user (default: admin@example.com)
"""

import sys
import os
import logging
import argparse
import secrets
import string
from configparser import ConfigParser
from sqlalchemy import select
from pathlib import Path
import warnings

# Fix for passlib and bcrypt 4.3.0+ compatibility issue
# Monkey patch bcrypt to provide the version attribute that passlib expects
try:
    import bcrypt
    if not hasattr(bcrypt, '__about__'):
        # Create a minimal __about__ module with a __version__ attribute
        class AboutModule:
            __version__ = getattr(bcrypt, '__version__', '4.0.0')
        bcrypt.__about__ = AboutModule()
except ImportError:
    pass

# Suppress remaining bcrypt version warnings from passlib
warnings.filterwarnings("ignore", message="error reading bcrypt version")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("init_postgres")

# Add the project root directory to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import app modules
from app.core.database import SessionLocal, init_db
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.core.security import get_password_hash
from app.core.db_config import db_config, Environment

# Standard permissions to ensure are present
STANDARD_PERMISSIONS = [
    # General Dashboard Permissions
    {"name": "VIEW_DASHBOARD", "description": "Permission to view the dashboard"},
    
    # System-wide Admin Permissions
    {"name": "SYSTEM_ADMIN", "description": "Full system administration permissions"},
    
    # User Module
    {"name": "MANAGE_USERS", "description": "General permission to manage users"},
    {"name": "VIEW_USERS", "description": "Permission to view users"},
    {"name": "CREATE_USER", "description": "Permission to create users"},
    {"name": "MODIFY_USER", "description": "Permission to modify users"},
    {"name": "DELETE_USER", "description": "Permission to delete users"},
    
    # Role Module
    {"name": "MANAGE_ROLES", "description": "General permission to manage roles"},
    {"name": "VIEW_ROLES", "description": "Permission to view roles"},
    {"name": "CREATE_ROLE", "description": "Permission to create roles"},
    {"name": "MODIFY_ROLE", "description": "Permission to modify roles"},
    {"name": "DELETE_ROLE", "description": "Permission to delete roles"},
    {"name": "ASSIGN_ROLE", "description": "Permission to assign roles to users"},
    
    # Permission Module
    {"name": "MANAGE_PERMISSIONS", "description": "General permission to manage permissions"},
    {"name": "VIEW_PERMISSIONS", "description": "Permission to view permissions"},
    {"name": "CREATE_PERMISSION", "description": "Permission to create permissions"},
    {"name": "MODIFY_PERMISSION", "description": "Permission to modify permissions"},
    {"name": "DELETE_PERMISSION", "description": "Permission to delete permissions"},
    {"name": "ASSIGN_PERMISSION", "description": "Permission to assign permissions to roles"},
    
    # Portfolio Module
    {"name": "MANAGE_PORTFOLIOS", "description": "General permission to manage portfolios"},
    {"name": "VIEW_PORTFOLIOS", "description": "Permission to view portfolios"},
    {"name": "CREATE_PORTFOLIO", "description": "Permission to create portfolios"},
    {"name": "MODIFY_PORTFOLIO", "description": "Permission to modify portfolios"},
    {"name": "DELETE_PORTFOLIO", "description": "Permission to delete portfolios"},
    {"name": "PUBLISH_PORTFOLIO", "description": "Permission to publish portfolios"},
    
    # Project Module
    {"name": "MANAGE_PROJECTS", "description": "General permission to manage projects"},
    {"name": "VIEW_PROJECTS", "description": "Permission to view projects"},
    {"name": "CREATE_PROJECT", "description": "Permission to create projects"},
    {"name": "MODIFY_PROJECT", "description": "Permission to modify projects"},
    {"name": "DELETE_PROJECT", "description": "Permission to delete projects"},
    {"name": "ASSIGN_PROJECT_CATEGORY", "description": "Permission to assign categories to projects"},
    
    # Skill Module
    {"name": "MANAGE_SKILLS", "description": "General permission to manage skills"},
    {"name": "VIEW_SKILLS", "description": "Permission to view skills"},
    {"name": "CREATE_SKILL", "description": "Permission to create skills"},
    {"name": "MODIFY_SKILL", "description": "Permission to modify skills"},
    {"name": "DELETE_SKILL", "description": "Permission to delete skills"},
    
    # Skill Type Module
    {"name": "MANAGE_SKILL_TYPES", "description": "General permission to manage skill types"},
    {"name": "VIEW_SKILL_TYPES", "description": "Permission to view skill types"},
    {"name": "CREATE_SKILL_TYPE", "description": "Permission to create skill types"},
    {"name": "MODIFY_SKILL_TYPE", "description": "Permission to modify skill types"},
    {"name": "DELETE_SKILL_TYPE", "description": "Permission to delete skill types"},
    
    # Category Module
    {"name": "MANAGE_CATEGORIES", "description": "General permission to manage categories"},
    {"name": "VIEW_CATEGORIES", "description": "Permission to view categories"},
    {"name": "CREATE_CATEGORY", "description": "Permission to create categories"},
    {"name": "MODIFY_CATEGORY", "description": "Permission to modify categories"},
    {"name": "DELETE_CATEGORY", "description": "Permission to delete categories"},
    
    # Category Type Module
    {"name": "MANAGE_CATEGORY_TYPES", "description": "General permission to manage category types"},
    {"name": "VIEW_CATEGORY_TYPES", "description": "Permission to view category types"},
    {"name": "CREATE_CATEGORY_TYPE", "description": "Permission to create category types"},
    {"name": "MODIFY_CATEGORY_TYPE", "description": "Permission to modify category types"},
    {"name": "DELETE_CATEGORY_TYPE", "description": "Permission to delete category types"},
    
    # Experience Module
    {"name": "MANAGE_EXPERIENCES", "description": "General permission to manage experiences"},
    {"name": "VIEW_EXPERIENCES", "description": "Permission to view experiences"},
    {"name": "CREATE_EXPERIENCE", "description": "Permission to create experiences"},
    {"name": "MODIFY_EXPERIENCE", "description": "Permission to modify experiences"},
    {"name": "DELETE_EXPERIENCE", "description": "Permission to delete experiences"},
    
    # Language Module
    {"name": "MANAGE_LANGUAGES", "description": "General permission to manage languages"},
    {"name": "VIEW_LANGUAGES", "description": "Permission to view languages"},
    {"name": "CREATE_LANGUAGE", "description": "Permission to create languages"},
    {"name": "MODIFY_LANGUAGE", "description": "Permission to modify languages"},
    {"name": "DELETE_LANGUAGE", "description": "Permission to delete languages"},
    
    # Section Module
    {"name": "MANAGE_SECTIONS", "description": "General permission to manage sections"},
    {"name": "VIEW_SECTIONS", "description": "Permission to view sections"},
    {"name": "CREATE_SECTION", "description": "Permission to create sections"},
    {"name": "MODIFY_SECTION", "description": "Permission to modify sections"},
    {"name": "DELETE_SECTION", "description": "Permission to delete sections"},
    
    # Translation Module
    {"name": "MANAGE_TRANSLATIONS", "description": "General permission to manage translations"},
    {"name": "VIEW_TRANSLATIONS", "description": "Permission to view translations"},
    {"name": "CREATE_TRANSLATION", "description": "Permission to create translations"},
    {"name": "MODIFY_TRANSLATION", "description": "Permission to modify translations"},
    {"name": "DELETE_TRANSLATION", "description": "Permission to delete translations"},
    
    # Email Functionality
    {"name": "SEND_EMAIL", "description": "Permission to send emails from the system"},
    {"name": "VIEW_EMAIL_TEMPLATES", "description": "Permission to view email templates"},
    {"name": "MODIFY_EMAIL_TEMPLATES", "description": "Permission to modify email templates"},
    
    # Import/Export Functionality
    {"name": "IMPORT_DATA", "description": "Permission to import data into the system"},
    {"name": "EXPORT_DATA", "description": "Permission to export data from the system"},
    
    # System Configuration
    {"name": "MANAGE_SYSTEM_SETTINGS", "description": "Permission to manage system settings"},
    {"name": "VIEW_SYSTEM_LOGS", "description": "Permission to view system logs"},
    
    # Analytics and Reporting
    {"name": "VIEW_ANALYTICS", "description": "Permission to view analytics"},
    {"name": "GENERATE_REPORTS", "description": "Permission to generate reports"},
]

# Default roles with their assigned permissions
DEFAULT_ROLES = [
    {
        "name": "Administrator",
        "description": "Full system administrator with all permissions",
        "permissions": ["SYSTEM_ADMIN"]  # This permission implies all others
    },
    {
        "name": "Content Manager",
        "description": "Can manage all content but cannot manage users, roles or system settings",
        "permissions": [
            "VIEW_DASHBOARD",
            "MANAGE_PORTFOLIOS", "VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "MODIFY_PORTFOLIO", "DELETE_PORTFOLIO", "PUBLISH_PORTFOLIO",
            "MANAGE_PROJECTS", "VIEW_PROJECTS", "CREATE_PROJECT", "MODIFY_PROJECT", "DELETE_PROJECT", "ASSIGN_PROJECT_CATEGORY",
            "MANAGE_SKILLS", "VIEW_SKILLS", "CREATE_SKILL", "MODIFY_SKILL", "DELETE_SKILL",
            "MANAGE_SKILL_TYPES", "VIEW_SKILL_TYPES", "CREATE_SKILL_TYPE", "MODIFY_SKILL_TYPE", "DELETE_SKILL_TYPE",
            "MANAGE_CATEGORIES", "VIEW_CATEGORIES", "CREATE_CATEGORY", "MODIFY_CATEGORY", "DELETE_CATEGORY",
            "MANAGE_CATEGORY_TYPES", "VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "MODIFY_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE",
            "MANAGE_EXPERIENCES", "VIEW_EXPERIENCES", "CREATE_EXPERIENCE", "MODIFY_EXPERIENCE", "DELETE_EXPERIENCE",
            "MANAGE_LANGUAGES", "VIEW_LANGUAGES", "CREATE_LANGUAGE", "MODIFY_LANGUAGE", "DELETE_LANGUAGE",
            "MANAGE_SECTIONS", "VIEW_SECTIONS", "CREATE_SECTION", "MODIFY_SECTION", "DELETE_SECTION",
            "MANAGE_TRANSLATIONS", "VIEW_TRANSLATIONS", "CREATE_TRANSLATION", "MODIFY_TRANSLATION", "DELETE_TRANSLATION",
            "EXPORT_DATA"
        ]
    },
    {
        "name": "Editor",
        "description": "Can edit content but cannot delete or create new content items",
        "permissions": [
            "VIEW_DASHBOARD",
            "VIEW_PORTFOLIOS", "MODIFY_PORTFOLIO",
            "VIEW_PROJECTS", "MODIFY_PROJECT",
            "VIEW_SKILLS", "MODIFY_SKILL",
            "VIEW_SKILL_TYPES", "MODIFY_SKILL_TYPE",
            "VIEW_CATEGORIES", "MODIFY_CATEGORY",
            "VIEW_CATEGORY_TYPES", "MODIFY_CATEGORY_TYPE",
            "VIEW_EXPERIENCES", "MODIFY_EXPERIENCE",
            "VIEW_LANGUAGES", "MODIFY_LANGUAGE",
            "VIEW_SECTIONS", "MODIFY_SECTION",
            "VIEW_TRANSLATIONS", "MODIFY_TRANSLATION"
        ]
    },
    {
        "name": "Viewer",
        "description": "Read-only access to the system",
        "permissions": [
            "VIEW_DASHBOARD", 
            "VIEW_PORTFOLIOS", "VIEW_PROJECTS", "VIEW_SKILLS", "VIEW_SKILL_TYPES",
            "VIEW_CATEGORIES", "VIEW_CATEGORY_TYPES", "VIEW_EXPERIENCES", "VIEW_LANGUAGES",
            "VIEW_SECTIONS", "VIEW_TRANSLATIONS"
        ]
    },
    {
        "name": "User Manager",
        "description": "Can manage users and roles but not content",
        "permissions": [
            "VIEW_DASHBOARD",
            "MANAGE_USERS", "VIEW_USERS", "CREATE_USER", "MODIFY_USER", "DELETE_USER",
            "MANAGE_ROLES", "VIEW_ROLES", "CREATE_ROLE", "MODIFY_ROLE", "DELETE_ROLE", "ASSIGN_ROLE",
            "VIEW_PERMISSIONS", "ASSIGN_PERMISSION"
        ]
    }
]

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Initialize database with permissions, roles, and admin user.")
    
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
    
    parser.add_argument("--username", "-u", default="admin",
                        help="Username for the admin user")
    
    parser.add_argument("--password", "-p", 
                        help="Password for the admin user (if not provided, a secure password will be generated)")
    
    parser.add_argument("--email", 
                        help="Email for the admin user (if not provided, will use username@example.com)")
    
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
    
    # Force the specific database connection for this environment
    if env_name.lower() == 'staging':
        staging_url = os.getenv("DATABASE_URL_STAGING")
        if staging_url:
            logger.info(f"Using explicit staging database URL from environment")
            # Override the db_config.db_url directly to ensure we use the staging URL
            db_config.db_url = staging_url
    
    logger.info(f"Using database: {db_config.current_environment}")
    return actual_env

def ensure_permissions_exist():
    """Ensure all standard permissions exist in the database."""
    db = SessionLocal()
    try:
        # Get all existing permissions
        existing_permissions = db.execute(select(Permission.name)).scalars().all()
        existing_permissions_set = set(existing_permissions)
        
        # Create permissions that don't exist
        permissions_added = 0
        for perm_data in STANDARD_PERMISSIONS:
            if perm_data["name"] not in existing_permissions_set:
                perm = Permission(**perm_data)
                db.add(perm)
                permissions_added += 1
        
        if permissions_added > 0:
            db.commit()
            logger.info(f"Added {permissions_added} standard permissions to the database")
        else:
            logger.info("All standard permissions already exist")
            
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error ensuring permissions exist: {str(e)}")
        return False
    finally:
        db.close()

def create_default_roles():
    """Create default roles and assign permissions."""
    db = SessionLocal()
    try:
        # Get all permissions by name
        permissions = {p.name: p for p in db.execute(select(Permission)).scalars().all()}
        
        # Get existing roles
        existing_roles = db.execute(select(Role.name)).scalars().all()
        existing_roles_set = set(existing_roles)
        
        # Create roles that don't exist
        roles_added = 0
        roles_by_name = {}
        
        for role_data in DEFAULT_ROLES:
            role_name = role_data["name"]
            if role_name not in existing_roles_set:
                # Create the role
                role = Role(
                    name=role_name,
                    description=role_data["description"]
                )
                db.add(role)
                db.flush()  # Flush to get the role ID
                
                # Assign permissions to the role using the many-to-many relationship
                for perm_name in role_data["permissions"]:
                    if perm_name in permissions:
                        role.permissions.append(permissions[perm_name])
                
                roles_added += 1
                roles_by_name[role_name] = role
            else:
                # Get existing role
                role = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
                roles_by_name[role_name] = role
        
        if roles_added > 0:
            db.commit()
            logger.info(f"Added {roles_added} default roles to the database")
        else:
            logger.info("All default roles already exist")
        
        return roles_by_name
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating default roles: {str(e)}")
        return {}
    finally:
        db.close()

def generate_secure_password(length=16):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

def create_admin_user(username, password, email, admin_role):
    """Create a system admin user with the Administrator role."""
    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.execute(
            select(User).where(User.username == username)
        ).scalar_one_or_none()
        
        if existing_user:
            logger.info(f"Admin user '{username}' already exists")
            return True
        
        # Generate password if not provided
        if not password:
            password = generate_secure_password()
            logger.info(f"Generated secure password for admin user: {password}")
            logger.info("PLEASE SAVE THIS PASSWORD!")
        
        # Create default email if not provided
        if not email:
            email = f"{username}@example.com"
        
        # Create the admin user
        admin_user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True
        )
        
        # Add the user to the database
        db.add(admin_user)
        db.flush()  # Flush to get the user ID
        
        # Assign the Administrator role
        admin_user.roles.append(admin_role)
        
        db.commit()
        logger.info(f"Created admin user '{username}' with Administrator role")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating admin user: {str(e)}")
        return False
    finally:
        db.close()

def initialize_postgres_db(args):
    """Initialize the PostgreSQL database with permissions, roles, and admin user."""
    try:
        # Set the environment
        set_environment(args.environment)
        
        # Ensure the database schema is initialized
        init_db()
        logger.info("Database schema initialized")
        
        # Step 1: Create standard permissions
        if not ensure_permissions_exist():
            logger.error("Failed to create standard permissions")
            return False
        
        # Step 2: Create default roles including Administrator
        roles_by_name = create_default_roles()
        if not roles_by_name:
            logger.error("Failed to create default roles")
            return False
        
        # Get the Administrator role
        admin_role = roles_by_name.get("Administrator")
        if not admin_role:
            logger.error("Administrator role not found")
            return False
        
        # Step 3: Create system admin user with Administrator role
        if not create_admin_user(args.username, args.password, args.email, admin_role):
            logger.error("Failed to create admin user")
            return False
        
        logger.info(f"PostgreSQL database in environment '{args.environment}' initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Error initializing PostgreSQL database: {str(e)}")
        return False

if __name__ == "__main__":
    args = parse_arguments()
    if initialize_postgres_db(args):
        sys.exit(0)
    else:
        sys.exit(1)