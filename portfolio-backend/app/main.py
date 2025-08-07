import sys
import os
import logging
import time
from datetime import timedelta

from fastapi import FastAPI, Request, Depends, HTTPException, status, Response
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

# Set up logger
logger = setup_logger("app.main")

# Ensure upload directories exist
ensure_upload_dirs()

# Set up logger for database operations
db_logger = setup_logger("app.core.database")

# Lifespan event manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Starting up Portfolio API...")
    logger.info(f"Environment: {db_config.current_environment}")
    logger.info(f"Database URL: {db_config.url}")
    
    # Initialize database with core roles and permissions
    db = SessionLocal()
    try:
        # Initialize core roles (which will also initialize permissions)
        initialize_core_roles(db)
        logger.info("Core roles and permissions initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing core roles: {e}")
    finally:
        db.close()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Portfolio API...")

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    description="Portfolio API for portfolio management",
    debug=settings.DEBUG,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Specify frontend URLs explicitly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to block unauthorized requests to specific endpoints
@app.middleware("http")
async def block_unauthorized_loops(request: Request, call_next):
    """Drop unauthorized requests to category-types to prevent log spam from stale clients."""
    
    # Check if this is an unauthorized request to category-types
    # BUT allow OPTIONS requests (CORS preflight) to pass through
    if ("/api/category-types" in request.url.path and 
        request.method != "OPTIONS" and 
        not request.headers.get("authorization")):
        
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
    """Handle validation errors."""
    errors = exc.errors()
    error_messages = []
    
    for error in errors:
        error_messages.append({
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"Validation error: {error_messages}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({"detail": error_messages}),
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle SQLAlchemy errors."""
    logger.error(f"Database error: {str(exc)}", exc_info=True)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": "Database error occurred"})

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError exceptions."""
    logger.warning(f"ValueError: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": str(exc)},
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)
logger.debug("API router included with prefix '/api'")

# Mount static files directory for serving uploads
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_DIR)), name="uploads")
logger.debug(f"Static files mounted at /uploads -> {settings.UPLOADS_DIR}")

# Routes
@app.get("/")
async def root():
    """Root endpoint for health checks."""
    return {
        "message": "Portfolio API is running",
        "version": settings.VERSION,
        "environment": db_config.current_environment
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "db_connected": True,  # This could check for actual DB connection
        "db_type": "PostgreSQL",
        "env": db_config.current_environment
    }

if __name__ == "__main__":
    import uvicorn
    
    # Determine port (allow environment override)
    port = int(os.getenv("PORT", 8000))
    
    # Run the app
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)



