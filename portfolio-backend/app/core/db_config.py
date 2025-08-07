"""
Database Environment Configuration
---------------------------------

This module provides robust configuration for multiple PostgreSQL database environments.
It supports development, testing, staging, and production environments with
appropriate settings for each.

Usage:
    The module automatically detects the current environment based on the
    ENVIRONMENT variable or defaults to development if not specified.
"""

import os
import logging
import dotenv
from urllib.parse import urlparse, parse_qs, quote, unquote
from enum import Enum, auto
from typing import Dict, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# Load .env file explicitly
dotenv.load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

class Environment(str, Enum):
    """Available environments for the application."""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"

class DBConfig:
    """Database configuration handler for multiple PostgreSQL environments."""
    
    # Default database names for different environments
    DEFAULT_DB_NAMES = {
        Environment.DEVELOPMENT: "portfolioai_dev",
        Environment.TESTING: "portfolioai_test",
        Environment.STAGING: "portfolioai_staging",
        Environment.PRODUCTION: "portfolioai",
    }
    
    def __init__(self):
        """Initialize database configuration with current environment."""
        self.env = self._detect_environment()
        self.db_url = self._get_database_url()
        self._validate_config()
        logger.info(f"Database environment initialized: {self.env}")
        self._log_masked_db_url()
    
    def _detect_environment(self) -> Environment:
        """Detect current environment from environment variable."""
        env_name = os.getenv("ENVIRONMENT", "development").lower()
        
        if env_name == "prod":
            env_name = "production"
        elif env_name == "dev":
            env_name = "development"
        
        try:
            return Environment(env_name)
        except ValueError:
            logger.warning(f"Unknown environment: {env_name}, defaulting to development")
            return Environment.DEVELOPMENT
    
    def _get_database_url(self) -> str:
        """Get the appropriate PostgreSQL URL for current environment."""
        # Check for environment-specific DB URL first
        env_specific_url = os.getenv(f"DATABASE_URL_{self.env.upper()}")
        if env_specific_url:
            if not env_specific_url.startswith('postgresql://'):
                logger.warning(f"Non-PostgreSQL URL provided for {self.env}. PostgreSQL is required.")
                raise ValueError(f"Only PostgreSQL is supported. Invalid URL: {env_specific_url.split('://', 1)[0]}")
            return env_specific_url
        
        # Fall back to generic DATABASE_URL if available
        base_url = os.getenv("DATABASE_URL")
        
        # If no valid database URL is found, use a default PostgreSQL URL for development
        if not base_url:
            if self.env == Environment.DEVELOPMENT:
                logger.warning("No DATABASE_URL found. Using default PostgreSQL connection for development.")
                return f"postgresql://postgres:postgres@localhost:5432/{self.DEFAULT_DB_NAMES[self.env]}"
            else:
                # For non-development environments, we require explicit PostgreSQL config
                raise ValueError(f"No PostgreSQL database URL configured for {self.env} environment. "
                              f"Please set DATABASE_URL or DATABASE_URL_{self.env.upper()} in your .env file.")
        
        # Verify and modify the base URL for PostgreSQL
        if not base_url.startswith('postgresql://'):
            logger.warning(f"Non-PostgreSQL URL provided. PostgreSQL is required.")
            raise ValueError(f"Only PostgreSQL is supported. Invalid URL: {base_url.split('://', 1)[0]}")
        
        # Modify the base URL to use environment-specific database
        return self._adjust_postgres_url(base_url)
    
    def _adjust_postgres_url(self, url: str) -> str:
        """Adjust PostgreSQL URL for current environment."""
        parsed = urlparse(url)
        path_parts = parsed.path.split('/')
        
        # If using the default 'portfolioai' DB in production, adjust for other environments
        if self.env != Environment.PRODUCTION and path_parts[-1] == 'portfolioai':
            path_parts[-1] = self.DEFAULT_DB_NAMES[self.env]
            new_path = '/'.join(path_parts)
            
            # Reconstruct the URL with the new database name
            netloc = parsed.netloc
            scheme = parsed.scheme
            new_url = f"{scheme}://{netloc}{new_path}"
            
            # Add query parameters if they exist
            if parsed.query:
                new_url += f"?{parsed.query}"
                
            return new_url
        
        return url
    
    def _validate_config(self) -> None:
        """Validate the current database configuration."""
        if not self.db_url:
            raise ValueError("Database URL cannot be empty")
        
        # Ensure PostgreSQL is used
        if not self.db_url.startswith('postgresql://'):
            raise ValueError("Only PostgreSQL is supported")
        
        # For PostgreSQL, validate structure
        try:
            parsed = urlparse(self.db_url)
            if not parsed.hostname or not parsed.path or parsed.path == '/':
                raise ValueError("Invalid PostgreSQL URL structure")
        except Exception as e:
            raise ValueError(f"Invalid PostgreSQL URL: {str(e)}")
    
    def _log_masked_db_url(self) -> None:
        """Log database URL with password masked for security."""
        try:
            parsed = urlparse(self.db_url)
            masked_netloc = parsed.netloc
            
            if '@' in masked_netloc:
                prefix, suffix = masked_netloc.split('@', 1)
                if ':' in prefix:
                    username, _ = prefix.split(':', 1)
                    masked_netloc = f"{username}:******@{suffix}"
            
            masked_url = f"{parsed.scheme}://{masked_netloc}{parsed.path}"
            logger.info(f"Using PostgreSQL database: {masked_url}")
        except Exception:
            # If anything goes wrong, don't expose the URL
            logger.info("Using PostgreSQL database (details masked)")
    
    @property
    def url(self) -> str:
        """Get the current database URL."""
        return self.db_url
    
    @property
    def is_production(self) -> bool:
        """Check if current environment is production."""
        return self.env == Environment.PRODUCTION
    
    @property
    def is_testing(self) -> bool:
        """Check if current environment is testing."""
        return self.env == Environment.TESTING

    @property
    def is_development(self) -> bool:
        """Check if current environment is development."""
        return self.env == Environment.DEVELOPMENT
    
    @property
    def current_environment(self) -> str:
        """Get the name of the current environment."""
        return self.env
    
    def get_connection_args(self) -> Dict[str, Any]:
        """Get connection arguments based on current database type."""
        # PostgreSQL doesn't need special connection args
        return {}

# Create a singleton instance for global use
db_config = DBConfig() 