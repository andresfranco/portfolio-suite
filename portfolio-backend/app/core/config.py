from pydantic_settings import BaseSettings
from pydantic import field_validator, ConfigDict
from typing import Any, Optional
import os
from datetime import timedelta
from pathlib import Path

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
    
    # File storage settings
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STATIC_DIR: Path = BASE_DIR / "static"
    UPLOADS_DIR: Path = STATIC_DIR / "uploads"
    
    # SMTP Settings
    #Set values from .env file
    SMTP_HOST: str = os.getenv("SMTP_HOST")
    SMTP_PORT: int = os.getenv("SMTP_PORT")
    SMTP_USER: str = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD")
    SMTP_TLS: bool = os.getenv("SMTP_TLS")
    SMTP_SSL: bool = os.getenv("SMTP_SSL")
    
    # Security settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your_secret_key_here_replace_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    ALLOWED_HOSTS: list[str] = ["*"]
    DEBUG: bool = True
    
    @field_validator("STATIC_DIR", "UPLOADS_DIR", mode="after")
    def create_directories(cls, v: Path) -> Path:
        """Ensure directories exist"""
        if not v.exists():
            v.mkdir(parents=True, exist_ok=True)
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

    # Replace class Config with model_config
    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"  # Allow extra fields from environment
    )

settings = Settings()