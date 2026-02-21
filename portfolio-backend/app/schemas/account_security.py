"""
Account Security Pydantic Schemas

Request and response models for account security endpoints:
- Password reset
- Email verification  
- Password change
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class PasswordResetRequestSchema(BaseModel):
    """Request to initiate password reset"""
    email: EmailStr = Field(..., description="User's email address")


class PasswordResetRequestResponse(BaseModel):
    """Response after initiating password reset"""
    message: str = "If an account with that email exists, a password reset link has been sent"


class PasswordResetConfirmSchema(BaseModel):
    """Request to complete password reset"""
    token: str = Field(..., min_length=32, description="Password reset token")
    new_password: str = Field(..., min_length=8, description="New password")
    
    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password meets complexity requirements."""
        errors = []
        
        if len(v) < 8:
            errors.append("Password must be at least 8 characters long")
        
        if not any(c.isupper() for c in v):
            errors.append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in v):
            errors.append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in v):
            errors.append("Password must contain at least one digit")
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in v):
            errors.append("Password must contain at least one special character")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v


class PasswordResetConfirmResponse(BaseModel):
    """Response after completing password reset"""
    success: bool
    message: str


class PasswordChangeSchema(BaseModel):
    """Request to change password (authenticated user)"""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    
    @field_validator('new_password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password meets complexity requirements."""
        errors = []
        
        if len(v) < 8:
            errors.append("Password must be at least 8 characters long")
        
        if not any(c.isupper() for c in v):
            errors.append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in v):
            errors.append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in v):
            errors.append("Password must contain at least one digit")
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in v):
            errors.append("Password must contain at least one special character")
        
        if errors:
            raise ValueError("; ".join(errors))
        
        return v


class PasswordChangeResponse(BaseModel):
    """Response after changing password"""
    success: bool
    message: str


class EmailVerificationRequestSchema(BaseModel):
    """Request to send email verification"""
    email: Optional[EmailStr] = Field(None, description="Email address (optional, uses current user's email if not provided)")


class EmailVerificationRequestResponse(BaseModel):
    """Response after sending verification email"""
    message: str = "Verification email sent"


class EmailVerificationConfirmSchema(BaseModel):
    """Request to verify email"""
    token: str = Field(..., min_length=32, description="Email verification token")


class EmailVerificationConfirmResponse(BaseModel):
    """Response after verifying email"""
    success: bool
    message: str


class AccountStatusResponse(BaseModel):
    """Response with account security status"""
    is_locked: bool = False
    lockout_minutes_remaining: Optional[int] = None
    failed_login_attempts: int = 0
    email_verified: bool = False
    mfa_enabled: bool = False
    force_password_change: bool = False
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    password_changed_at: Optional[datetime] = None
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "is_locked": False,
                "failed_login_attempts": 0,
                "email_verified": True,
                "mfa_enabled": False,
                "force_password_change": False,
                "last_login_at": "2025-10-22T10:30:00Z",
                "last_login_ip": "192.168.1.100",
                "password_changed_at": "2025-10-20T08:15:00Z"
            }
        }
    }

