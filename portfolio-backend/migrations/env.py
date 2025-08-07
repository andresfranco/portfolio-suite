from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy import create_engine

from alembic import context

# Ensure the project root is on sys.path
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import Base  # Ensure Base includes your models
from app.core.config import settings  # Import settings for DB URL
from app.core.db_config import db_config, Environment  # Import the database configuration

# Import models so they register with Base.metadata
import app.models.user  
import app.models.role  
# Import all other models
import app.models.category
import app.models.experience
import app.models.language
import app.models.permission
import app.models.portfolio
import app.models.project
import app.models.section
import app.models.skill
import app.models.translation
import app.models.category_type
import app.models.skill_type

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# Get the environment from command line or use the current app environment
cmd_kwargs = context.get_x_argument(as_dictionary=True)
if 'environment' in cmd_kwargs:
    env_name = cmd_kwargs['environment'].lower()
    if env_name in [e.value for e in Environment]:
        db_environment = Environment(env_name)
    else:
        print(f"Warning: Environment '{env_name}' not recognized. Using default environment.")
        db_environment = db_config.current_environment
else:
    db_environment = db_config.current_environment

# Print the current database environment
print(f"Current environment: {db_environment}")

# Get DB URL from alembic.ini sections or fall back to app config
def get_url():
    # Try to get the URL from the appropriate section in alembic.ini
    try:
        # Access the config file directly to get sections
        from configparser import ConfigParser
        cfg_parser = ConfigParser()
        cfg_parser.read(context.config.config_file_name)
        
        if db_environment.value in cfg_parser.sections():
            # Get the URL from the correct section
            if 'sqlalchemy.url' in cfg_parser[db_environment.value]:
                url = cfg_parser[db_environment.value]['sqlalchemy.url']
                print(f"Using database URL from alembic.ini [{db_environment.value}] section")
                return url
    except Exception as e:
        print(f"Error accessing alembic.ini sections: {str(e)}")
    
    # Fall back to the application's db_config
    print(f"Using database URL from application config")
    return db_config.url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_url()
    print(f"Using database URL: {url}")
    
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    url = get_url()
    print(f"Using database URL: {url}")
    
    connectable = create_engine(url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True  # Add type comparison for migrations
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
