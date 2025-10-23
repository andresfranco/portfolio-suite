"""
MFA Pydantic Schemas

Request and response models for Multi-Factor Authentication endpoints.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class MFAEnrollmentRequest(BaseModel):
    """Request to start MFA enrollment"""
    password: str = Field(..., description="Current password for verification")
    user_id: Optional[int] = Field(None, description="User ID (for admin to enroll other users)")


class MFAEnrollmentResponse(BaseModel):
    """Response with enrollment data"""
    secret: str = Field(..., description="TOTP secret (base32)")
    qr_code_url: str = Field(..., description="Data URL of QR code image")
    backup_codes: List[str] = Field(..., description="One-time backup codes")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "secret": "JBSWY3DPEHPK3PXP",
                "qr_code_url": "data:image/png;base64,iVBORw0KGg...",
                "backup_codes": ["ABCD-1234", "EFGH-5678"]
            }
        }
    }


class MFAVerifyEnrollmentRequest(BaseModel):
    """Request to verify and complete MFA enrollment"""
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")
    user_id: Optional[int] = Field(None, description="User ID (for admin to verify other users)")
    
    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError('Code must contain only digits')
        return v


class MFAVerifyEnrollmentResponse(BaseModel):
    """Response after completing MFA enrollment"""
    success: bool
    message: str


class MFALoginVerifyRequest(BaseModel):
    """Request to verify MFA code during login"""
    username: str = Field(..., description="Username")
    code: str = Field(..., min_length=6, max_length=8, description="6-digit TOTP or 8-char backup code")
    use_backup_code: bool = Field(False, description="Whether this is a backup code")


class MFALoginVerifyResponse(BaseModel):
    """Response after MFA verification"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class MFADisableRequest(BaseModel):
    """Request to disable MFA"""
    password: str = Field(..., description="Current password for verification")
    code: Optional[str] = Field(None, description="Current TOTP code or backup code")
    user_id: Optional[int] = Field(None, description="User ID (for admin to disable other users)")


class MFADisableResponse(BaseModel):
    """Response after disabling MFA"""
    success: bool
    message: str


class MFAResetDeviceRequest(BaseModel):
    """Request to reset MFA device (for users who lost their authenticator)"""
    password: str = Field(..., description="Current password for verification")
    user_id: Optional[int] = Field(None, description="User ID (for admin to reset other users)")


class MFAResetDeviceResponse(BaseModel):
    """Response with new MFA device enrollment data"""
    secret: str = Field(..., description="New TOTP secret (base32)")
    qr_code_url: str = Field(..., description="Data URL of QR code image")
    backup_codes: List[str] = Field(..., description="New one-time backup codes")
    message: str = Field(default="MFA device reset successfully. Scan the QR code with your new authenticator app.")


class MFARegenerateBackupCodesRequest(BaseModel):
    """Request to regenerate backup codes"""
    password: str = Field(..., description="Admin password for verification")
    code: Optional[str] = Field(None, min_length=6, max_length=6, description="Admin TOTP code (only if admin has MFA)")
    user_id: Optional[int] = Field(None, description="User ID (for admin to regenerate codes for other users)")


class MFARegenerateBackupCodesResponse(BaseModel):
    """Response with new backup codes"""
    backup_codes: List[str]
    generated_at: datetime


class MFAStatusResponse(BaseModel):
    """Response with user's MFA status"""
    mfa_enabled: bool
    backup_codes_remaining: Optional[int] = None
    enrolled_at: Optional[datetime] = None
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "mfa_enabled": True,
                "backup_codes_remaining": 8,
                "enrolled_at": "2025-10-22T10:30:00Z"
            }
        }
    }


class MFARequiredResponse(BaseModel):
    """
    Response when MFA verification is required.
    Returned instead of tokens on initial login.
    """
    mfa_required: bool = True
    message: str = "MFA verification required"
    session_token: Optional[str] = Field(None, description="Temporary session token for MFA verification")

