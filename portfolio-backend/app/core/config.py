from pydantic_settings import BaseSettings
from pydantic import field_validator, validator, ConfigDict
from typing import Any, Optional, List
import os
import secrets
from datetime import timedelta
from pathlib import Path
import logging

class Settings(BaseSettings):
    # API settings
    PROJECT_NAME: str = "Portfolio API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database settings
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres@localhost:5432/portfolioai"
    )
    # Environment-specific database URLs
    DATABASE_URL_DEVELOPMENT: Optional[str] = os.getenv(
        "DATABASE_URL_DEVELOPMENT",
        "postgresql://postgres:postgres@localhost:5432/portfolioai_dev"
    )
    DATABASE_URL_TESTING: Optional[str] = os.getenv(
        "DATABASE_URL_TESTING",
        "postgresql://postgres:postgres@localhost:5432/portfolioai_test"
    )
    DATABASE_URL_STAGING: Optional[str] = os.getenv(
        "DATABASE_URL_STAGING"
    )
    
    # Database connection pool settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 0
    DB_POOL_TIMEOUT: int = 30
    DB_SSL_ENABLED: bool = False
    DB_SSL_MODE: str = "prefer"  # Options: disable, allow, prefer, require, verify-ca, verify-full
    
    # File storage settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STATIC_DIR: Path = BASE_DIR / "static"
    UPLOADS_DIR: Path = STATIC_DIR / "uploads"
    MAX_UPLOAD_SIZE: int = 10485760  # 10MB in bytes
    ALLOWED_EXTENSIONS: str = "jpg,jpeg,png,gif,pdf,doc,docx"
    
    # SMTP Settings
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST")
    SMTP_PORT: Optional[int] = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "True").lower() == "true"
    SMTP_SSL: bool = os.getenv("SMTP_SSL", "False").lower() == "true"
    SMTP_FROM_EMAIL: Optional[str] = os.getenv("SMTP_FROM_EMAIL")
    SMTP_FROM_NAME: Optional[str] = os.getenv("SMTP_FROM_NAME", "Portfolio API")
    
    # Security settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")  # HS256 or RS256
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # RSA Keys for RS256 (if using asymmetric JWT signing)
    JWT_PRIVATE_KEY_PATH: Optional[str] = os.getenv("JWT_PRIVATE_KEY_PATH")
    JWT_PUBLIC_KEY_PATH: Optional[str] = os.getenv("JWT_PUBLIC_KEY_PATH")
    JWT_PRIVATE_KEY: Optional[str] = os.getenv("JWT_PRIVATE_KEY")  # Alternative: key as env var
    JWT_PUBLIC_KEY: Optional[str] = os.getenv("JWT_PUBLIC_KEY")  # Alternative: key as env var
    
    # CORS settings
    FRONTEND_ORIGINS: str = os.getenv(
        "FRONTEND_ORIGINS", 
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    
    # Host settings - environment dependent
    ALLOWED_HOSTS: str = os.getenv("ALLOWED_HOSTS", "*")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # Logging configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "text")  # text or json
    LOG_SQL: bool = os.getenv("LOG_SQL", "False").lower() == "true"
    LOG_FILE: Optional[str] = os.getenv("LOG_FILE")
    
    # Security headers
    HSTS_ENABLED: bool = os.getenv("HSTS_ENABLED", "False").lower() == "true"
    HSTS_MAX_AGE: int = int(os.getenv("HSTS_MAX_AGE", "31536000"))
    CSP_ENABLED: bool = os.getenv("CSP_ENABLED", "True").lower() == "true"
    
    # Rate limiting & DDoS protection
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "False").lower() == "true"
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    RATE_LIMIT_PER_HOUR: int = int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))
    RATE_LIMIT_PER_DAY: int = int(os.getenv("RATE_LIMIT_PER_DAY", "10000"))
    
    # Request size limits
    MAX_REQUEST_SIZE: int = int(os.getenv("MAX_REQUEST_SIZE", str(10 * 1024 * 1024)))  # 10MB default
    MAX_UPLOAD_SIZE_OVERRIDE: int = int(os.getenv("MAX_UPLOAD_SIZE_OVERRIDE", str(10 * 1024 * 1024)))  # 10MB for uploads
    
    # Slow request protection
    SLOW_REQUEST_THRESHOLD: int = int(os.getenv("SLOW_REQUEST_THRESHOLD", "30"))  # seconds
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "30"))  # seconds
    
    # IP blocking
    AUTO_BLOCK_ENABLED: bool = os.getenv("AUTO_BLOCK_ENABLED", "True").lower() == "true"
    BLOCK_THRESHOLD_VIOLATIONS: int = int(os.getenv("BLOCK_THRESHOLD_VIOLATIONS", "10"))
    BLOCK_DURATION: int = int(os.getenv("BLOCK_DURATION", "3600"))  # 1 hour in seconds
    
    @field_validator("STATIC_DIR", "UPLOADS_DIR", mode="after")
    def create_directories(cls, v: Path) -> Path:
        """Ensure directories exist"""
        if not v.exists():
            v.mkdir(parents=True, exist_ok=True)
        return v
    
    @field_validator("SECRET_KEY")
    def validate_secret_key(cls, v: str, info) -> str:
        """Validate SECRET_KEY is set properly in production"""
        # Get environment from values (will be available during validation)
        env = info.data.get("ENVIRONMENT", "development").lower()
        
        if env in ["production", "staging"]:
            if not v or v == "" or "change" in v.lower() or "replace" in v.lower() or len(v) < 32:
                raise ValueError(
                    f"SECRET_KEY must be set to a secure random value (min 32 chars) in {env} environment. "
                    f"Generate one with: openssl rand -hex 32"
                )
        elif not v:
            # In development, generate a random key if not set
            logging.warning("SECRET_KEY not set, generating random key for development")
            v = secrets.token_hex(32)
        
        return v
    
    @field_validator("DEBUG")
    def validate_debug(cls, v: bool, info) -> bool:
        """Ensure DEBUG is False in production"""
        env = info.data.get("ENVIRONMENT", "development").lower()
        
        if env == "production" and v:
            raise ValueError("DEBUG must be False in production environment")
        
        return v
    
    @field_validator("ALLOWED_HOSTS")
    def validate_allowed_hosts(cls, v: str, info) -> str:
        """Validate ALLOWED_HOSTS in production"""
        env = info.data.get("ENVIRONMENT", "development").lower()
        
        if env == "production" and v == "*":
            raise ValueError(
                "ALLOWED_HOSTS must be set to specific domains in production, not '*'"
            )
        
        return v

    def get_db_url(self) -> str:
        """Get the database URL based on the current environment."""
        env = self.ENVIRONMENT.lower()
        
        if env == "development" and self.DATABASE_URL_DEVELOPMENT:
            return self.DATABASE_URL_DEVELOPMENT
        elif env == "testing" and self.DATABASE_URL_TESTING:
            return self.DATABASE_URL_TESTING
        elif env == "staging" and self.DATABASE_URL_STAGING:
            return self.DATABASE_URL_STAGING
        
        return self.DATABASE_URL
    
    def get_allowed_origins(self) -> List[str]:
        """Parse and return allowed CORS origins"""
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]
    
    def get_allowed_extensions(self) -> List[str]:
        """Parse and return allowed file extensions"""
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()]
    
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"
    
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT.lower() == "development"
    
    def is_testing(self) -> bool:
        """Check if running in testing"""
        return self.ENVIRONMENT.lower() == "testing"
    
    def get_private_key(self) -> Optional[str]:
        """
        Get RSA private key for JWT signing (RS256 only).
        
        Returns:
            Private key as PEM string, or None if using HS256
        """
        if self.ALGORITHM != "RS256":
            return None
        
        # Check if key is provided as environment variable
        if self.JWT_PRIVATE_KEY:
            return self.JWT_PRIVATE_KEY
        
        # Check if key file path is provided
        if self.JWT_PRIVATE_KEY_PATH:
            try:
                with open(self.JWT_PRIVATE_KEY_PATH, 'r') as f:
                    return f.read()
            except FileNotFoundError:
                logging.error(f"Private key file not found: {self.JWT_PRIVATE_KEY_PATH}")
                raise ValueError(
                    f"JWT_PRIVATE_KEY_PATH points to non-existent file: {self.JWT_PRIVATE_KEY_PATH}. "
                    f"Generate keys with: python scripts/generate_rsa_keys.py"
                )
            except PermissionError:
                logging.error(f"Cannot read private key file: {self.JWT_PRIVATE_KEY_PATH}")
                raise ValueError(
                    f"Permission denied reading private key: {self.JWT_PRIVATE_KEY_PATH}. "
                    f"Ensure file permissions are set to 600 (owner read/write only)"
                )
        
        # RS256 requires private key
        raise ValueError(
            "RS256 algorithm requires JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH. "
            "Generate keys with: python scripts/generate_rsa_keys.py"
        )
    
    def get_public_key(self) -> Optional[str]:
        """
        Get RSA public key for JWT verification (RS256 only).
        
        Returns:
            Public key as PEM string, or None if using HS256
        """
        if self.ALGORITHM != "RS256":
            return None
        
        # Check if key is provided as environment variable
        if self.JWT_PUBLIC_KEY:
            return self.JWT_PUBLIC_KEY
        
        # Check if key file path is provided
        if self.JWT_PUBLIC_KEY_PATH:
            try:
                with open(self.JWT_PUBLIC_KEY_PATH, 'r') as f:
                    return f.read()
            except FileNotFoundError:
                logging.error(f"Public key file not found: {self.JWT_PUBLIC_KEY_PATH}")
                raise ValueError(
                    f"JWT_PUBLIC_KEY_PATH points to non-existent file: {self.JWT_PUBLIC_KEY_PATH}. "
                    f"Generate keys with: python scripts/generate_rsa_keys.py"
                )
        
        # RS256 requires public key
        raise ValueError(
            "RS256 algorithm requires JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH. "
            "Generate keys with: python scripts/generate_rsa_keys.py"
        )
    
    def get_jwt_secret_or_key(self) -> str:
        """
        Get the appropriate secret/key for JWT operations based on algorithm.
        
        For HS256: Returns SECRET_KEY
        For RS256: Returns private key for signing, public key for verification
        
        Returns:
            Secret key (HS256) or private key (RS256)
        """
        if self.ALGORITHM == "RS256":
            return self.get_private_key()
        else:
            return self.SECRET_KEY

    # Replace class Config with model_config
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"  # Allow extra fields from environment
    )

settings = Settings()