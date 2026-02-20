import sys
import os
import logging
import time
from datetime import timedelta

from fastapi import FastAPI, Request, Depends, HTTPException, status, Response
from dotenv import load_dotenv  # Ensure .env values load into os.environ for non-Settings reads
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware  # Add CORS middleware
from fastapi.staticfiles import StaticFiles  # Import StaticFiles for serving static content
from fastapi.openapi.utils import get_openapi
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
# Import utils and logging
from app.utils.file_utils import ensure_upload_dirs  # Import to ensure upload directories exist
from app.core.logging import setup_logger
from app.core.config import settings
from app.core.db_config import db_config
from app.api.router import api_router
from app.crud.permission import initialize_core_permissions
from app.crud.role import initialize_core_roles  # Add this import
from app.core.database import SessionLocal as _SessionLocal
from sqlalchemy import text as _text
from app.rag.hooks import register_after_commit_hook
from sqlalchemy.orm import Session as _SQLASession
from app.queue.celery_app import is_enabled as _celery_enabled
from app.observability.metrics import CONTENT_TYPE_LATEST, generate_latest
from app import models as _models

# Load .env into process environment so os.getenv works for keys like AGENT_KMS_KEY / OPENAI_API_KEY
load_dotenv()

# Set up logger
logger = setup_logger("app.main")

# Ensure upload directories exist
ensure_upload_dirs()

# Set up logger for database operations
db_logger = setup_logger("app.core.database")

# Import rate limiter and JWT manager
from app.core.rate_limiter import rate_limiter
from app.core.jwt_enhanced import jwt_manager

# Lifespan event manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Starting up Portfolio API...")
    logger.info(f"Environment: {db_config.current_environment}")
    logger.info(f"Database URL: {db_config.url}")
    
    # Initialize rate limiter
    await rate_limiter.initialize()
    
    # Initialize enhanced JWT manager
    await jwt_manager.initialize()
    
    # Initialize database with core roles and permissions
    db = SessionLocal()
    try:
        # Initialize core roles (which will also initialize permissions)
        initialize_core_roles(db)
        logger.info("Core roles and permissions initialized successfully")
        # Apply RAG and embedding settings from system_settings to environment
        try:
            rows = db.execute(_text("SELECT key, value FROM system_settings WHERE key IN ('rag.default_tenant_id','rag.default_visibility','rag.chunk_chars','rag.chunk_overlap','rag.debounce_seconds','rag.allow_fields','rag.redact_regex','embed.provider','embed.model')")).fetchall()
            kv = {k: v for k, v in rows}
            env_map = {
                'rag.default_tenant_id': 'DEFAULT_TENANT_ID',
                'rag.default_visibility': 'DEFAULT_VISIBILITY',
                'rag.chunk_chars': 'CHUNK_CHARS',
                'rag.chunk_overlap': 'CHUNK_OVERLAP',
                'rag.debounce_seconds': 'RAG_DEBOUNCE_SECONDS',
                'rag.allow_fields': 'RAG_ALLOW_FIELDS',
                'rag.redact_regex': 'RAG_REDACT_REGEX',
                'embed.provider': 'EMBED_PROVIDER',
                'embed.model': 'EMBED_MODEL',
            }
            for k, envk in env_map.items():
                val = kv.get(k)
                if val is not None and str(val) != "":
                    os.environ[envk] = str(val)
            logger.info("Applied RAG settings from system_settings to environment")
        except Exception as e:
            logger.warning(f"Could not apply RAG settings from DB: {e}")
        # Ensure embedding provider/model and OPENAI key are present for indexers
        try:
            # Defaults if not explicitly configured
            os.environ.setdefault('EMBED_PROVIDER', os.getenv('EMBED_PROVIDER') or 'openai')
            os.environ.setdefault('EMBED_MODEL', os.getenv('EMBED_MODEL') or 'text-embedding-3-small')
            # Decrypt first OpenAI credential if OPENAI_API_KEY not set
            if not os.getenv('OPENAI_API_KEY'):
                cred = db.query(_models.AgentCredential).filter(_models.AgentCredential.provider == 'openai').first()
                if cred and cred.api_key_encrypted:
                    row = db.execute(_text("SELECT pgp_sym_decrypt(decode(:b64,'base64'), :k) AS api_key"), {
                        'b64': cred.api_key_encrypted,
                        'k': os.getenv('AGENT_KMS_KEY')
                    }).first()
                    if row and row[0]:
                        os.environ['OPENAI_API_KEY'] = row[0]
                        logger.info("Loaded OPENAI_API_KEY from database credential for embedding/indexing")
        except Exception as e:
            logger.warning(f"Could not set embedding provider/api key from DB: {e}")
    except Exception as e:
        logger.error(f"Error initializing core roles: {e}")
    finally:
        db.close()
    # Ensure vector extension if available (non-fatal)
    try:
        with _SessionLocal() as s:
            s.execute(_text("CREATE EXTENSION IF NOT EXISTS vector;"))
            s.commit()
    except Exception:
        pass
    # Log celery readiness
    try:
        if _celery_enabled():
            logger.info("Celery broker configured; background worker can be used")
        else:
            logger.info("Celery broker not configured; using inline indexing")
    except Exception:
        pass
    
    yield
    
    # Shutdown
    logger.info("Shutting down Portfolio API...")
    
    # Close rate limiter
    await rate_limiter.close()
    
    # Close JWT manager
    await jwt_manager.close()

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    description="Portfolio API for portfolio management",
    debug=settings.DEBUG,
)

# Import security middleware
from app.middleware.security_headers import SecurityHeadersMiddleware, RequestIDMiddleware
from app.middleware.rate_limit import RateLimitMiddleware, SlowRequestMiddleware, RequestSizeLimitMiddleware
from app.middleware.csrf import CSRFProtectionMiddleware

# Determine allowed CORS origins based on environment
if settings.is_production():
    # In production, only use explicitly configured origins
    allowed_origins = settings.get_allowed_origins()
    # Validate that production origins are HTTPS
    for origin in allowed_origins:
        if not origin.startswith('https://') and not origin.startswith('http://localhost'):
            logger.warning(f"Non-HTTPS origin in production: {origin}")
else:
    # In development, include default localhost origins
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    
    # Get configured origins
    configured_origins = settings.get_allowed_origins()
    
    # Merge while preserving order & uniqueness
    seen = set()
    merged = []
    for o in configured_origins + default_origins:
        if o not in seen:
            seen.add(o)
            merged.append(o)
    allowed_origins = merged

# Log CORS configuration (only in development)
if settings.is_development():
    logger.info(f"CORS allowed origins: {allowed_origins}")
else:
    logger.info(f"CORS configured with {len(allowed_origins)} allowed origin(s)")

# Add security headers middleware (add before CORS)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

# Add CSRF protection middleware (enabled by default, can be disabled via env)
csrf_enabled = getattr(settings, 'CSRF_PROTECTION_ENABLED', True)
app.add_middleware(CSRFProtectionMiddleware, enabled=csrf_enabled)
if csrf_enabled:
    logger.info("CSRF protection middleware enabled")
else:
    logger.warning("CSRF protection is DISABLED - only for development!")

# Add rate limiting middleware (if enabled)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware, max_request_size=settings.MAX_REQUEST_SIZE)
    app.add_middleware(SlowRequestMiddleware, timeout=settings.REQUEST_TIMEOUT)
    logger.info("Rate limiting middleware enabled")
else:
    logger.info("Rate limiting is disabled")

# Add request size limit middleware (always enabled for security)
app.add_middleware(RequestSizeLimitMiddleware, max_size=settings.MAX_REQUEST_SIZE)

# Configure CORS with environment-specific settings
if settings.is_production():
    # Strict CORS in production
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,  # Required for httpOnly cookies
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Specific methods only
        allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token"],  # Include CSRF token
        max_age=3600,  # Cache preflight requests for 1 hour
    )
else:
    # Permissive CORS in development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,  # Required for httpOnly cookies
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Middleware to block unauthorized requests to specific endpoints
@app.middleware("http")
async def block_unauthorized_loops(request: Request, call_next):
    """Drop unauthorized requests to category-types to prevent log spam from stale clients."""
    
    # Check if this is an unauthorized request to category-types
    # BUT allow OPTIONS requests (CORS preflight) to pass through
    # Check for authentication via Authorization header OR access_token cookie
    has_auth = (
        request.headers.get("authorization") or 
        request.cookies.get("access_token")
    )
    
    if ("/api/category-types" in request.url.path and 
        request.method != "OPTIONS" and 
        not has_auth):
        
        # Log detailed information about the source of these requests
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "unknown")
        origin = request.headers.get("origin", "none")
        referer = request.headers.get("referer", "none")
        
        logger.warning(
            f"BLOCKING: Unauthorized {request.method} request to {request.url.path} from {client_ip}. "
            f"User-Agent: {user_agent}, Origin: {origin}, Referer: {referer}. "
            f"This is likely a stale browser tab - find and close it!"
        )
        
        # Return 403 Forbidden with a clear message
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "Unauthorized request blocked. Close any open browser tabs for this application.",
                "source": "middleware_block",
                "path": request.url.path,
                "method": request.method
            }
        )
    
    return await call_next(request)

# Set up custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Portfolio API for portfolio management",
        routes=app.routes,
    )
    
    # Add API information
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    
    # Add tags metadata
    openapi_schema["tags"] = [
        {
            "name": "Portfolio",
            "description": "Portfolio management endpoints",
        },
        {
            "name": "Users",
            "description": "User management endpoints",
        },
        {
            "name": "Authentication",
            "description": "Authentication and authorization endpoints",
        },
        # Add more tags as needed
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors.
    In production: Return sanitized error messages
    In development: Return detailed validation errors
    """
    errors = exc.errors()
    error_messages = []
    
    for error in errors:
        error_messages.append({
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"]
        })
    
    # Log the error (detailed in dev, minimal in prod)
    if settings.is_development():
        logger.warning(f"Validation error: {error_messages}")
    else:
        logger.warning(f"Validation error on {request.url.path}")
    
    # Return appropriate detail based on environment
    if settings.is_production():
        # In production, return generic message without exposing internal structure
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Invalid request data", "code": "VALIDATION_ERROR"},
        )
    else:
        # In development, return detailed errors
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=jsonable_encoder({"detail": error_messages}),
        )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Handle SQLAlchemy errors.
    In production: Generic error message, no details leaked
    In development: Include error type for debugging
    """
    # Always log the full error server-side
    logger.error(f"Database error: {str(exc)}", exc_info=True)
    
    if settings.is_production():
        # Generic error in production
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            content={"detail": "An error occurred while processing your request", "code": "DATABASE_ERROR"}
        )
    else:
        # More helpful error in development
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            content={"detail": "Database error occurred", "type": type(exc).__name__}
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Handle uncaught exceptions.
    In production: Generic error, no stack traces or details
    In development: Include exception type and message
    """
    # Get request ID if available
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    # Always log the full error server-side with request ID
    logger.error(
        f"Unhandled exception (request_id: {request_id}): {str(exc)}", 
        exc_info=True,
        extra={"request_id": request_id, "path": request.url.path}
    )
    
    if settings.is_production():
        # Generic error in production with request ID for support
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected error occurred. Please contact support if the issue persists.",
                "code": "INTERNAL_ERROR",
                "request_id": request_id
            },
        )
    else:
        # Include exception details in development
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected error occurred",
                "type": type(exc).__name__,
                "message": str(exc),
                "request_id": request_id
            },
        )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """
    Handle ValueError exceptions.
    These are typically application-level validation errors.
    """
    # Log based on environment
    if settings.is_development():
        logger.warning(f"ValueError: {str(exc)}")
    else:
        logger.warning(f"ValueError on {request.url.path}")
    
    # Return error (message is usually safe to expose)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc), "code": "INVALID_INPUT"},
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)
logger.debug("API router included with prefix '/api'")

# Register after_commit hook for RAG events
try:
    from sqlalchemy.orm import Session as _Session
    register_after_commit_hook(_Session)
except Exception:
    pass

# Mount static files directory for serving uploads
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_DIR)), name="uploads")
logger.debug(f"Static files mounted at /uploads -> {settings.UPLOADS_DIR}")

# Routes
@app.get("/")
async def root():
    """
    Root endpoint for health checks.
    In production: Minimal information
    In development: Include environment details
    """
    response = {
        "message": "Portfolio API is running",
        "version": settings.VERSION,
    }
    
    # Only expose environment in non-production
    if not settings.is_production():
        response["environment"] = db_config.current_environment
    
    return response

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    In production: Minimal information for security
    In development: Detailed information for debugging
    """
    response = {
        "status": "healthy",
    }
    
    # Add detailed info only in non-production
    if not settings.is_production():
        response.update({
            "db_connected": True,  # This could check for actual DB connection
            "db_type": "PostgreSQL",
            "env": db_config.current_environment
        })
    
    return response

@app.get("/readyz")
async def readyz():
    """Readiness probe with Celery status hint."""
    ready = True
    worker = False
    try:
        worker = _celery_enabled()
    except Exception:
        worker = False
    return {"ready": ready, "worker_enabled": worker}

@app.get("/metrics")
async def metrics():
    body = generate_latest()
    return Response(content=body, media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import uvicorn
    
    # Determine port (allow environment override)
    port = int(os.getenv("PORT", 8000))
    
    # Run the app
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)



