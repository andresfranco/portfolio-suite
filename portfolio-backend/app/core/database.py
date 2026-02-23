from sqlalchemy import create_engine, event, pool
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.db_config import db_config
from app.core.config import settings
from app.core.logging import setup_logger
import os

# Set up logger for the database module
logger = setup_logger("app.core.database")

# Use the environment-specific DATABASE_URL
SQLALCHEMY_DATABASE_URL = db_config.url
logger.debug(f"Database URL resolved for environment '{db_config.current_environment}': {db_config.url}")

# ---------------------------------------------------------------------------
# Engine configuration — built conditionally per environment.
#
# NullPool (used for testing) does NOT support pool_size, max_overflow,
# pool_timeout, or pool_recycle. Those parameters are only valid when a
# real connection pool (QueuePool, etc.) is in use.
# ---------------------------------------------------------------------------

if settings.is_testing():
    # Testing: NullPool — each connection is opened and closed immediately.
    # No pool parameters are allowed with NullPool.
    engine_config = {
        "poolclass": pool.NullPool,
        "pool_pre_ping": True,
    }
    logger.info("Using NullPool for testing environment (no connection pooling)")

elif settings.is_production():
    # Production: conservative pool tuned for stability under load.
    engine_config = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True,
        "pool_recycle": 1800,   # Recycle connections every 30 min in prod
    }
    logger.info("Using QueuePool for production environment")

elif settings.is_staging() if hasattr(settings, "is_staging") else False:
    # Staging: mirrors production config but with slightly relaxed limits.
    engine_config = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }
    logger.info("Using QueuePool for staging environment")

else:
    # Development (and any other environment): standard pool, longer recycle.
    engine_config = {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }
    logger.info(f"Using QueuePool for {db_config.current_environment} environment")

# ---------------------------------------------------------------------------
# SSL configuration (added to engine_config when enabled)
# ---------------------------------------------------------------------------
connect_args = {}
if settings.DB_SSL_ENABLED:
    connect_args["sslmode"] = settings.DB_SSL_MODE
    logger.info(f"Database SSL enabled with mode: {settings.DB_SSL_MODE}")

    # In production, enforce SSL certificate verification if configured.
    if settings.is_production() and settings.DB_SSL_MODE in ["verify-ca", "verify-full"]:
        ssl_ca   = os.getenv("DB_SSL_CA_CERT")
        ssl_cert = os.getenv("DB_SSL_CLIENT_CERT")
        ssl_key  = os.getenv("DB_SSL_CLIENT_KEY")

        if ssl_ca:
            connect_args["sslrootcert"] = ssl_ca
        if ssl_cert:
            connect_args["sslcert"] = ssl_cert
        if ssl_key:
            connect_args["sslkey"] = ssl_key

if connect_args:
    engine_config["connect_args"] = connect_args

# ---------------------------------------------------------------------------
# Create the SQLAlchemy engine
# ---------------------------------------------------------------------------
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_config)

# ---------------------------------------------------------------------------
# Connection event listeners
# ---------------------------------------------------------------------------

@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Called when a new raw DBAPI connection is established.

    Sets per-connection PostgreSQL parameters for security and consistency.
    """
    if settings.is_development():
        logger.debug("New database connection established")

    cursor = dbapi_conn.cursor()

    # Statement timeout: 30 s in production, 60 s everywhere else.
    timeout_ms = 30000 if settings.is_production() else 60000
    cursor.execute(f"SET statement_timeout = {timeout_ms}")

    # Always use UTC so timestamps are environment-independent.
    cursor.execute("SET timezone = 'UTC'")

    cursor.close()


@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Called when a connection is checked out from the pool.

    Only fires for pooled environments (not NullPool / testing).
    """
    if settings.is_development() and settings.LOG_SQL:
        logger.debug("Database connection checked out from pool")


# ---------------------------------------------------------------------------
# Session factory and declarative base
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# Dependency & helpers
# ---------------------------------------------------------------------------

def get_db():
    """Yield a database session for FastAPI dependency injection.

    Ensures the session is always closed after the request, even on error.

    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables defined in SQLAlchemy models.

    Should be called once at application startup.  Model modules are
    imported here (not at the top of the file) to avoid circular imports.
    """
    from app.models import (                        # noqa: F401
        user, role, permission, category_type, skill_type,
        portfolio, project, section, skill, category,
        experience, language, translation,
    )

    Base.metadata.create_all(bind=engine)
    logger.info(
        f"PostgreSQL database tables initialised for environment: "
        f"{db_config.current_environment}"
    )

    if db_config.is_production:
        logger.info("Running with PRODUCTION database")
    elif db_config.is_development:
        logger.info("Running with DEVELOPMENT database")
    elif db_config.is_testing:
        logger.info("Running with TESTING database")
    else:
        logger.info(f"Running with {db_config.current_environment.upper()} database")